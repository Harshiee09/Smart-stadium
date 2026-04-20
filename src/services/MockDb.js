/**
 * mockDB.js
 * In-browser mock database using localStorage
 * Tables: users, tickets, sessions
 */

const DB_KEY = 'stadiumNexusDB'

function loadDB() {
    try {
        const raw = localStorage.getItem(DB_KEY)
        if (raw) return JSON.parse(raw)
    } catch { }
    return { users: {}, tickets: {}, sessions: {} }
}

function saveDB(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { }
}

function getDB() {
    return loadDB()
}

// ── Auth ──────────────────────────────────────────────────────

export function dbSignUp({ name, email, password }) {
    const db = getDB()
    const id = email.toLowerCase().trim()
    if (db.users[id]) return { ok: false, error: 'An account with this email already exists.' }
    const user = { id, name: name.trim(), email: id, passwordHash: btoa(password), createdAt: Date.now() }
    db.users[id] = user
    saveDB(db)
    return { ok: true, user: { id, name: user.name, email: id } }
}

export function dbLogin({ email, password }) {
    const db = getDB()
    const id = email.toLowerCase().trim()
    const user = db.users[id]
    if (!user) return { ok: false, error: 'No account found with this email.' }
    if (user.passwordHash !== btoa(password)) return { ok: false, error: 'Incorrect password.' }
    const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    db.sessions[token] = { userId: id, createdAt: Date.now() }
    saveDB(db)
    localStorage.setItem('stadiumSession', token)
    return { ok: true, user: { id, name: user.name, email: id }, token }
}

export function dbLogout() {
    const token = localStorage.getItem('stadiumSession')
    if (token) {
        const db = getDB()
        delete db.sessions[token]
        saveDB(db)
    }
    localStorage.removeItem('stadiumSession')
}

export function dbGetCurrentUser() {
    const token = localStorage.getItem('stadiumSession')
    if (!token) return null
    const db = getDB()
    const session = db.sessions[token]
    if (!session) return null
    const user = db.users[session.userId]
    if (!user) return null
    return { id: user.id, name: user.name, email: user.email }
}

// ── Tickets ───────────────────────────────────────────────────

export function dbSaveTicket(userId, ticketData) {
    const db = getDB()
    if (!db.tickets[userId]) db.tickets[userId] = []
    const existing = db.tickets[userId].findIndex(t => t.ticketId === ticketData.ticketId)
    const ticket = { ...ticketData, savedAt: Date.now() }
    if (existing >= 0) db.tickets[userId][existing] = ticket
    else db.tickets[userId].unshift(ticket)
    saveDB(db)
    return ticket
}

export function dbGetTickets(userId) {
    const db = getDB()
    return db.tickets[userId] || []
}

export function dbGetLatestTicket(userId) {
    const tickets = dbGetTickets(userId)
    return tickets[0] || null
}

export function dbDeleteTicket(userId, ticketId) {
    const db = getDB()
    if (db.tickets[userId]) {
        db.tickets[userId] = db.tickets[userId].filter(t => t.ticketId !== ticketId)
        saveDB(db)
    }
}