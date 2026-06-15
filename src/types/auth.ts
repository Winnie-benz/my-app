export type Role = 'admin' | 'staff'

export interface AuthUser {
  staff_id: string
  user: string
  first_name: string
  last_name: string
  nickname: string
  role: Role
  phone_no?: string
}
