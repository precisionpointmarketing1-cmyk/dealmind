import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string  // scrypt hash
  role: 'admin' | 'member'
  createdAt: string
}

export type PublicUser = Omit<User, 'passwordHash'>

const FILE = join(process.cwd(), 'data', 'users.json')

function ensureDir() {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function readUsers(): User[] {
  try {
    if (!existsSync(FILE)) return []
    return JSON.parse(readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeUsers(users: User[]) {
  ensureDir()
  writeFileSync(FILE, JSON.stringify(users, null, 2))
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const candidate = scryptSync(password, salt, 64)
    return timingSafeEqual(Buffer.from(hash, 'hex'), candidate)
  } catch {
    return false
  }
}

export function findUserByEmail(email: string): User | undefined {
  return readUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id: string): User | undefined {
  return readUsers().find(u => u.id === id)
}

export function createUser(name: string, email: string, password: string, role: 'admin' | 'member' = 'member'): User {
  const users = readUsers()
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('A user with that email already exists')
  }
  const user: User = {
    id: `user_${Date.now()}`,
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeUsers(users)
  return user
}

export function deleteUser(id: string) {
  const users = readUsers().filter(u => u.id !== id)
  writeUsers(users)
}

export function updateUserPassword(id: string, newPassword: string) {
  const users = readUsers()
  const user = users.find(u => u.id === id)
  if (!user) throw new Error('User not found')
  user.passwordHash = hashPassword(newPassword)
  writeUsers(users)
}

export function toPublicUser(u: User): PublicUser {
  const { passwordHash: _, ...pub } = u
  return pub
}

/** Bootstrap admin from env vars on first run */
export function ensureAdminUser() {
  const users = readUsers()
  if (users.length > 0) return  // already initialized

  const email = process.env.ADMIN_EMAIL ?? 'admin@dealmind.ai'
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Admin'

  if (!password) {
    throw new Error(
      'Cannot bootstrap admin user: ADMIN_PASSWORD environment variable is required. ' +
      'A hardcoded default would let anyone log in as admin.'
    )
  }

  const admin: User = {
    id: 'user_admin',
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role: 'admin',
    createdAt: new Date().toISOString(),
  }
  writeUsers([admin])
}
