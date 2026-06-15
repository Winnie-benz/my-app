export type Role = 'admin' | 'staff'

export interface Employee {
  user: string
  password_hash: string
  staff_id: string
  first_name: string
  last_name: string
  nickname: string
  status: string
  hired_date: string
  phone_no: string
  role: Role
}

export interface JWTPayload {
  staff_id: string
  user: string
  role: Role
  first_name: string
  last_name: string
  nickname: string
  iat?: number
  exp?: number
}
