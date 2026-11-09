/**
 * Department Master Database Service.
 * Authoritative client service for Hospital Departments with central backend synchronization,
 * multi-tab broadcast fan-out, and offline persistence.
 */

import { apiFetch } from "../lib/api"

export interface DepartmentItem {
  id: number | string
  department_name: string
  name: string
  code: string
  contact_phone?: string
  contactPhone?: string
  location?: string
  status: "active" | "inactive"
  capacity: number
  description?: string
  mapped_head_employee_id?: string
  headEmployeeId?: string
  doctor_count?: number
  doctorCount?: number
  created_at?: string
}

const STORAGE_KEY_DEPARTMENTS = "hospai_departments_v2"
const BROADCAST_CHANNEL = "hospai_departments_channel"

let broadcastChannel: BroadcastChannel | null = null
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL)
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "departments_updated") {
        window.dispatchEvent(new CustomEvent("departments_updated", { detail: event.data }))
      }
    }
  } catch {
    broadcastChannel = null
  }
}

export class DepartmentDatabase {
  private static notifyChange(action: string, dept?: DepartmentItem): void {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("departments_updated", { detail: { action, dept } }))
    try {
      broadcastChannel?.postMessage({ type: "departments_updated", action, dept })
    } catch {}
  }

  static getDepartments(): DepartmentItem[] {
    if (typeof window === "undefined") return []
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_DEPARTMENTS)
      if (!stored) {
        return []
      }
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  static saveDepartments(departments: DepartmentItem[]): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(departments))
      this.notifyChange("save_all")
    } catch (e) {
      console.error("Failed to save departments", e)
    }
  }

  static async syncFromBackend(): Promise<DepartmentItem[]> {
    try {
      const res = await apiFetch<{ success: boolean; departments: any[] }>("/api/admin/departments")
      if (res && res.departments && Array.isArray(res.departments)) {
        const mapped: DepartmentItem[] = res.departments.map((d: any) => ({
          id: d.id,
          department_name: d.department_name || d.name,
          name: d.department_name || d.name,
          code: d.code || (d.department_name ? d.department_name.slice(0, 4).toUpperCase() : "DEPT"),
          contact_phone: d.contact_phone || d.contactPhone || "",
          contactPhone: d.contact_phone || d.contactPhone || "",
          location: d.location || "",
          status: d.status || "active",
          capacity: d.capacity ?? 50,
          description: d.description || "",
          mapped_head_employee_id: d.mapped_head_employee_id || d.headEmployeeId || "",
          headEmployeeId: d.mapped_head_employee_id || d.headEmployeeId || "",
          doctor_count: d.doctor_count ?? d.doctorCount ?? 0,
          doctorCount: d.doctor_count ?? d.doctorCount ?? 0,
          created_at: d.created_at,
        }))
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(mapped))
          this.notifyChange("synced")
        }
        return mapped
      }
    } catch (e) {
      console.warn("Could not sync departments from backend:", e)
    }
    return this.getDepartments()
  }

  static async addDepartment(dept: Omit<DepartmentItem, "id"> & { id?: number | string }): Promise<DepartmentItem> {
    const list = this.getDepartments()
    const name = (dept.department_name || dept.name || "").trim()
    const code = (dept.code || name.slice(0, 4).toUpperCase()).trim()

    let newId = dept.id ?? (list.length > 0 ? Math.max(...list.map(d => Number(d.id) || 0)) + 1 : 101)

    // Attempt backend creation
    try {
      const res = await apiFetch<{ success: boolean; department_id: number }>("/api/admin/departments", {
        method: "POST",
        body: JSON.stringify({
          department_name: name,
          code,
          contact_phone: dept.contactPhone || dept.contact_phone || "",
          location: dept.location || "",
          status: dept.status || "active",
          capacity: dept.capacity || 50,
          description: dept.description || "",
          mapped_head_employee_id: dept.headEmployeeId || dept.mapped_head_employee_id || "",
        }),
      })
      if (res?.department_id) {
        newId = res.department_id
      }
    } catch (apiErr) {
      console.warn("Backend department creation failed, saving locally:", apiErr)
    }

    const newItem: DepartmentItem = {
      id: newId,
      department_name: name,
      name,
      code,
      contact_phone: dept.contactPhone || dept.contact_phone || "",
      contactPhone: dept.contactPhone || dept.contact_phone || "",
      location: dept.location || "",
      status: dept.status || "active",
      capacity: dept.capacity || 50,
      description: dept.description || "",
      mapped_head_employee_id: dept.headEmployeeId || dept.mapped_head_employee_id || "",
      headEmployeeId: dept.headEmployeeId || dept.mapped_head_employee_id || "",
      doctor_count: 0,
      doctorCount: 0,
      created_at: new Date().toISOString(),
    }

    const updated = [newItem, ...list.filter(d => d.id !== newId && d.name.toLowerCase() !== name.toLowerCase())]
    this.saveDepartments(updated)
    return newItem
  }

  static async updateDepartment(id: number | string, updates: Partial<DepartmentItem>): Promise<DepartmentItem | null> {
    const list = this.getDepartments()
    const idx = list.findIndex(d => String(d.id) === String(id))
    if (idx < 0) return null

    const existing = list[idx]
    const updatedItem: DepartmentItem = {
      ...existing,
      ...updates,
      department_name: updates.department_name || updates.name || existing.department_name,
      name: updates.department_name || updates.name || existing.name,
      contact_phone: updates.contactPhone || updates.contact_phone || existing.contact_phone,
      contactPhone: updates.contactPhone || updates.contact_phone || existing.contactPhone,
      headEmployeeId: updates.headEmployeeId || updates.mapped_head_employee_id || existing.headEmployeeId,
      mapped_head_employee_id: updates.headEmployeeId || updates.mapped_head_employee_id || existing.mapped_head_employee_id,
    }

    list[idx] = updatedItem
    this.saveDepartments(list)

    // Sync to backend
    try {
      await apiFetch(`/api/admin/departments/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          department_name: updatedItem.name,
          code: updatedItem.code,
          contact_phone: updatedItem.contactPhone,
          location: updatedItem.location,
          status: updatedItem.status,
          capacity: updatedItem.capacity,
          description: updatedItem.description,
          mapped_head_employee_id: updatedItem.headEmployeeId,
        }),
      })
    } catch (e) {
      console.warn("Backend update failed for department:", e)
    }

    return updatedItem
  }

  static async deleteDepartment(id: number | string): Promise<boolean> {
    const list = this.getDepartments()
    const updated = list.map(d => String(d.id) === String(id) ? { ...d, status: "inactive" as const } : d)
    this.saveDepartments(updated)

    try {
      await apiFetch(`/api/admin/departments/${id}`, { method: "DELETE" })
    } catch (e) {
      console.warn("Backend delete failed for department:", e)
    }

    return true
  }
}
