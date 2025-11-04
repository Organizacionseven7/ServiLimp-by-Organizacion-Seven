const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./servilimp.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'servilimp-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // Users table (operators, supervisors, admins)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('operator', 'supervisor', 'admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Clients table
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Objectives/Locations table
        db.run(`CREATE TABLE IF NOT EXISTS objectives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            client_id INTEGER,
            address TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )`);

        // Sectors within objectives
        db.run(`CREATE TABLE IF NOT EXISTS sectors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            objective_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (objective_id) REFERENCES objectives(id)
        )`);

        // Supplies/Products
        db.run(`CREATE TABLE IF NOT EXISTS supplies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            unit TEXT,
            quantity_in_stock REAL DEFAULT 0,
            min_stock_level REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Cleaning records (when a sector is cleaned)
        db.run(`CREATE TABLE IF NOT EXISTS cleaning_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sector_id INTEGER NOT NULL,
            operator_id INTEGER NOT NULL,
            cleaned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'completed',
            FOREIGN KEY (sector_id) REFERENCES sectors(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        )`);

        // Observations
        db.run(`CREATE TABLE IF NOT EXISTS observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sector_id INTEGER NOT NULL,
            operator_id INTEGER NOT NULL,
            observation TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sector_id) REFERENCES sectors(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        )`);

        // Messages
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )`);

        // Supply consumption tracking
        db.run(`CREATE TABLE IF NOT EXISTS supply_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supply_id INTEGER NOT NULL,
            objective_id INTEGER NOT NULL,
            operator_id INTEGER NOT NULL,
            quantity_used REAL NOT NULL,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supply_id) REFERENCES supplies(id),
            FOREIGN KEY (objective_id) REFERENCES objectives(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        )`);

        // Create default admin user
        const defaultPassword = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO users (id, username, password, name, role) 
                VALUES (1, 'admin', ?, 'Administrator', 'admin')`, [defaultPassword]);
    });
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// ====== Authentication Routes ======

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        bcrypt.compare(password, user.password, (err, match) => {
            if (err || !match) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.userName = user.name;
            
            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    name: user.name, 
                    role: user.role 
                } 
            });
        });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, (req, res) => {
    db.get('SELECT id, username, name, role FROM users WHERE id = ?', 
        [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    });
});

// ====== User Management Routes ======

// Get all users (admin/supervisor only)
app.get('/api/users', requireRole('admin', 'supervisor'), (req, res) => {
    db.all('SELECT id, username, name, role, created_at FROM users', (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(users);
    });
});

// Create user (admin only)
app.post('/api/users', requireRole('admin'), (req, res) => {
    const { username, password, name, role } = req.body;
    
    if (!username || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, name, role], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
        }
        res.json({ id: this.lastID, username, name, role });
    });
});

// Update user (admin only)
app.put('/api/users/:id', requireRole('admin'), (req, res) => {
    const { name, role } = req.body;
    const { id } = req.params;
    
    db.run('UPDATE users SET name = ?, role = ? WHERE id = ?',
        [name, role, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update user' });
        }
        res.json({ success: true });
    });
});

// Delete user (admin only)
app.delete('/api/users/:id', requireRole('admin'), (req, res) => {
    const { id } = req.params;
    
    if (id == 1) {
        return res.status(400).json({ error: 'Cannot delete admin user' });
    }
    
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete user' });
        }
        res.json({ success: true });
    });
});

// ====== Client Management Routes ======

// Get all clients
app.get('/api/clients', requireAuth, (req, res) => {
    db.all('SELECT * FROM clients ORDER BY name', (err, clients) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(clients);
    });
});

// Create client
app.post('/api/clients', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, contact, address, phone, email } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    db.run('INSERT INTO clients (name, contact, address, phone, email) VALUES (?, ?, ?, ?, ?)',
        [name, contact, address, phone, email], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create client' });
        }
        res.json({ id: this.lastID, name, contact, address, phone, email });
    });
});

// Update client
app.put('/api/clients/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, contact, address, phone, email } = req.body;
    const { id } = req.params;
    
    db.run('UPDATE clients SET name = ?, contact = ?, address = ?, phone = ?, email = ? WHERE id = ?',
        [name, contact, address, phone, email, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update client' });
        }
        res.json({ success: true });
    });
});

// Delete client
app.delete('/api/clients/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete client' });
        }
        res.json({ success: true });
    });
});

// ====== Objective Management Routes ======

// Get all objectives
app.get('/api/objectives', requireAuth, (req, res) => {
    db.all(`SELECT o.*, c.name as client_name 
            FROM objectives o 
            LEFT JOIN clients c ON o.client_id = c.id 
            ORDER BY o.name`, (err, objectives) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(objectives);
    });
});

// Create objective
app.post('/api/objectives', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, client_id, address, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    db.run('INSERT INTO objectives (name, client_id, address, description) VALUES (?, ?, ?, ?)',
        [name, client_id, address, description], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create objective' });
        }
        res.json({ id: this.lastID, name, client_id, address, description });
    });
});

// Update objective
app.put('/api/objectives/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, client_id, address, description } = req.body;
    const { id } = req.params;
    
    db.run('UPDATE objectives SET name = ?, client_id = ?, address = ?, description = ? WHERE id = ?',
        [name, client_id, address, description, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update objective' });
        }
        res.json({ success: true });
    });
});

// Delete objective
app.delete('/api/objectives/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM objectives WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete objective' });
        }
        res.json({ success: true });
    });
});

// ====== Sector Management Routes ======

// Get sectors by objective
app.get('/api/objectives/:objectiveId/sectors', requireAuth, (req, res) => {
    const { objectiveId } = req.params;
    
    db.all('SELECT * FROM sectors WHERE objective_id = ? ORDER BY name', 
        [objectiveId], (err, sectors) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(sectors);
    });
});

// Create sector
app.post('/api/sectors', requireRole('admin', 'supervisor'), (req, res) => {
    const { objective_id, name, description } = req.body;
    
    if (!objective_id || !name) {
        return res.status(400).json({ error: 'Objective and name are required' });
    }
    
    db.run('INSERT INTO sectors (objective_id, name, description) VALUES (?, ?, ?)',
        [objective_id, name, description], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create sector' });
        }
        res.json({ id: this.lastID, objective_id, name, description });
    });
});

// Update sector
app.put('/api/sectors/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, description } = req.body;
    const { id } = req.params;
    
    db.run('UPDATE sectors SET name = ?, description = ? WHERE id = ?',
        [name, description, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update sector' });
        }
        res.json({ success: true });
    });
});

// Delete sector
app.delete('/api/sectors/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM sectors WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete sector' });
        }
        res.json({ success: true });
    });
});

// ====== Cleaning Records Routes ======

// Mark sector as cleaned
app.post('/api/cleaning-records', requireAuth, (req, res) => {
    const { sector_id } = req.body;
    const operator_id = req.session.userId;
    
    if (!sector_id) {
        return res.status(400).json({ error: 'Sector ID is required' });
    }
    
    db.run('INSERT INTO cleaning_records (sector_id, operator_id) VALUES (?, ?)',
        [sector_id, operator_id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to record cleaning' });
        }
        res.json({ id: this.lastID, sector_id, operator_id });
    });
});

// Get cleaning records
app.get('/api/cleaning-records', requireAuth, (req, res) => {
    const { objective_id, start_date, end_date } = req.query;
    
    let query = `SELECT cr.*, s.name as sector_name, u.name as operator_name, 
                 o.name as objective_name
                 FROM cleaning_records cr
                 JOIN sectors s ON cr.sector_id = s.id
                 JOIN users u ON cr.operator_id = u.id
                 JOIN objectives o ON s.objective_id = o.id
                 WHERE 1=1`;
    const params = [];
    
    if (objective_id) {
        query += ' AND s.objective_id = ?';
        params.push(objective_id);
    }
    
    if (start_date) {
        query += ' AND cr.cleaned_at >= ?';
        params.push(start_date);
    }
    
    if (end_date) {
        query += ' AND cr.cleaned_at <= ?';
        params.push(end_date);
    }
    
    query += ' ORDER BY cr.cleaned_at DESC';
    
    db.all(query, params, (err, records) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(records);
    });
});

// ====== Observations Routes ======

// Create observation
app.post('/api/observations', requireAuth, (req, res) => {
    const { sector_id, observation } = req.body;
    const operator_id = req.session.userId;
    
    if (!sector_id || !observation) {
        return res.status(400).json({ error: 'Sector and observation are required' });
    }
    
    db.run('INSERT INTO observations (sector_id, operator_id, observation) VALUES (?, ?, ?)',
        [sector_id, operator_id, observation], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create observation' });
        }
        res.json({ id: this.lastID, sector_id, operator_id, observation });
    });
});

// Get observations
app.get('/api/observations', requireAuth, (req, res) => {
    const { sector_id, objective_id } = req.query;
    
    let query = `SELECT ob.*, s.name as sector_name, u.name as operator_name,
                 o.name as objective_name
                 FROM observations ob
                 JOIN sectors s ON ob.sector_id = s.id
                 JOIN users u ON ob.operator_id = u.id
                 JOIN objectives o ON s.objective_id = o.id
                 WHERE 1=1`;
    const params = [];
    
    if (sector_id) {
        query += ' AND ob.sector_id = ?';
        params.push(sector_id);
    }
    
    if (objective_id) {
        query += ' AND s.objective_id = ?';
        params.push(objective_id);
    }
    
    query += ' ORDER BY ob.created_at DESC';
    
    db.all(query, params, (err, observations) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(observations);
    });
});

// ====== Supply Management Routes ======

// Get all supplies
app.get('/api/supplies', requireAuth, (req, res) => {
    db.all('SELECT * FROM supplies ORDER BY name', (err, supplies) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(supplies);
    });
});

// Create supply
app.post('/api/supplies', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, description, unit, quantity_in_stock, min_stock_level } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    db.run('INSERT INTO supplies (name, description, unit, quantity_in_stock, min_stock_level) VALUES (?, ?, ?, ?, ?)',
        [name, description, unit, quantity_in_stock || 0, min_stock_level || 0], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create supply' });
        }
        res.json({ id: this.lastID, name, description, unit, quantity_in_stock, min_stock_level });
    });
});

// Update supply
app.put('/api/supplies/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { name, description, unit, quantity_in_stock, min_stock_level } = req.body;
    const { id } = req.params;
    
    db.run('UPDATE supplies SET name = ?, description = ?, unit = ?, quantity_in_stock = ?, min_stock_level = ? WHERE id = ?',
        [name, description, unit, quantity_in_stock, min_stock_level, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update supply' });
        }
        res.json({ success: true });
    });
});

// Delete supply
app.delete('/api/supplies/:id', requireRole('admin', 'supervisor'), (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM supplies WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete supply' });
        }
        res.json({ success: true });
    });
});

// ====== Supply Usage Routes ======

// Record supply usage
app.post('/api/supply-usage', requireAuth, (req, res) => {
    const { supply_id, objective_id, quantity_used } = req.body;
    const operator_id = req.session.userId;
    
    if (!supply_id || !objective_id || !quantity_used) {
        return res.status(400).json({ error: 'Supply, objective, and quantity are required' });
    }
    
    db.run('BEGIN TRANSACTION');
    
    // Record usage
    db.run('INSERT INTO supply_usage (supply_id, objective_id, operator_id, quantity_used) VALUES (?, ?, ?, ?)',
        [supply_id, objective_id, operator_id, quantity_used], function(err) {
        if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to record usage' });
        }
        
        // Update stock
        db.run('UPDATE supplies SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?',
            [quantity_used, supply_id], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to update stock' });
            }
            
            db.run('COMMIT');
            res.json({ success: true });
        });
    });
});

// Get supply usage
app.get('/api/supply-usage', requireAuth, (req, res) => {
    const { objective_id, supply_id, start_date, end_date } = req.query;
    
    let query = `SELECT su.*, s.name as supply_name, o.name as objective_name,
                 u.name as operator_name
                 FROM supply_usage su
                 JOIN supplies s ON su.supply_id = s.id
                 JOIN objectives o ON su.objective_id = o.id
                 JOIN users u ON su.operator_id = u.id
                 WHERE 1=1`;
    const params = [];
    
    if (objective_id) {
        query += ' AND su.objective_id = ?';
        params.push(objective_id);
    }
    
    if (supply_id) {
        query += ' AND su.supply_id = ?';
        params.push(supply_id);
    }
    
    if (start_date) {
        query += ' AND su.used_at >= ?';
        params.push(start_date);
    }
    
    if (end_date) {
        query += ' AND su.used_at <= ?';
        params.push(end_date);
    }
    
    query += ' ORDER BY su.used_at DESC';
    
    db.all(query, params, (err, usage) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(usage);
    });
});

// ====== Messaging Routes ======

// Send message
app.post('/api/messages', requireAuth, (req, res) => {
    const { to_user_id, message } = req.body;
    const from_user_id = req.session.userId;
    
    if (!to_user_id || !message) {
        return res.status(400).json({ error: 'Recipient and message are required' });
    }
    
    db.run('INSERT INTO messages (from_user_id, to_user_id, message) VALUES (?, ?, ?)',
        [from_user_id, to_user_id, message], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to send message' });
        }
        res.json({ id: this.lastID, from_user_id, to_user_id, message });
    });
});

// Get messages
app.get('/api/messages', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    db.all(`SELECT m.*, 
            u1.name as from_name, u1.role as from_role,
            u2.name as to_name, u2.role as to_role
            FROM messages m
            JOIN users u1 ON m.from_user_id = u1.id
            JOIN users u2 ON m.to_user_id = u2.id
            WHERE m.from_user_id = ? OR m.to_user_id = ?
            ORDER BY m.created_at DESC`, [userId, userId], (err, messages) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(messages);
    });
});

// Mark message as read
app.put('/api/messages/:id/read', requireAuth, (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;
    
    db.run('UPDATE messages SET read = 1 WHERE id = ? AND to_user_id = ?',
        [id, userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to mark as read' });
        }
        res.json({ success: true });
    });
});

// Get unread message count
app.get('/api/messages/unread/count', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    db.get('SELECT COUNT(*) as count FROM messages WHERE to_user_id = ? AND read = 0',
        [userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ count: result.count });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`ServiLimp server running on port ${PORT}`);
    console.log(`Default admin credentials: username=admin, password=admin123`);
});
