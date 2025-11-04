// Main application with Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserData = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Get session data
        try {
            const response = await fetch('/api/session');
            if (response.ok) {
                const session = await response.json();
                currentUserData = session;
                document.getElementById('userName').textContent = session.userName;
                document.getElementById('userRole').textContent = session.userRole;
                loadUnreadMessages();
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Session error:', error);
            window.location.href = '/';
        }
    } else {
        window.location.href = '/';
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Menu navigation
document.querySelectorAll('.menu a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        
        // Update active state
        document.querySelectorAll('.menu a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Load page content
        loadPage(page);
    });
});

// Load page content
function loadPage(page) {
    const content = document.getElementById('pageContent');
    
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'operators':
            loadOperators();
            break;
        case 'clients':
            loadClients();
            break;
        case 'objectives':
            loadObjectives();
            break;
        case 'supplies':
            loadSupplies();
            break;
        case 'cleaning':
            loadCleaning();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'reports':
            loadReports();
            break;
        default:
            content.innerHTML = '<h1>Página no encontrada</h1>';
    }
}

// Load dashboard
function loadDashboard() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <h1>Dashboard</h1>
        <div class="stats-grid">
            <div class="stat-card">
                <h4>Total Operarios</h4>
                <div class="stat-value" id="totalOperators">-</div>
            </div>
            <div class="stat-card">
                <h4>Total Clientes</h4>
                <div class="stat-value" id="totalClients">-</div>
            </div>
            <div class="stat-card">
                <h4>Total Objetivos</h4>
                <div class="stat-value" id="totalObjectives">-</div>
            </div>
            <div class="stat-card">
                <h4>Insumos Bajos</h4>
                <div class="stat-value" id="lowSupplies">-</div>
            </div>
        </div>
        
        <div class="card">
            <h3>Actividad Reciente</h3>
            <div id="recentActivity">Cargando...</div>
        </div>
    `;
    
    loadDashboardStats();
}

async function loadDashboardStats() {
    try {
        // Count operators
        const operatorsSnapshot = await getDocs(collection(db, 'users'));
        document.getElementById('totalOperators').textContent = operatorsSnapshot.size;
        
        // Count clients
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        document.getElementById('totalClients').textContent = clientsSnapshot.size;
        
        // Count objectives
        const objectivesSnapshot = await getDocs(collection(db, 'objectives'));
        document.getElementById('totalObjectives').textContent = objectivesSnapshot.size;
        
        // Count low supplies
        const suppliesSnapshot = await getDocs(collection(db, 'supplies'));
        let lowCount = 0;
        suppliesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.quantity_in_stock <= data.min_stock_level) {
                lowCount++;
            }
        });
        document.getElementById('lowSupplies').textContent = lowCount;
        
        // Load recent activity
        document.getElementById('recentActivity').innerHTML = '<p>No hay actividad reciente</p>';
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load operators page
function loadOperators() {
    const content = document.getElementById('pageContent');
    const isAdmin = currentUserData?.userRole === 'admin';
    
    content.innerHTML = `
        <h1>Gestión de Operarios</h1>
        ${isAdmin ? '<button class="btn btn-primary" onclick="showAddOperatorModal()">Agregar Operario</button>' : ''}
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol</th>
                        ${isAdmin ? '<th>Acciones</th>' : ''}
                    </tr>
                </thead>
                <tbody id="operatorsTableBody">
                    <tr><td colspan="${isAdmin ? 5 : 4}">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
        
        ${isAdmin ? `
        <div id="addOperatorModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Agregar Operario</h2>
                    <button class="close-modal" onclick="closeModal('addOperatorModal')">&times;</button>
                </div>
                <form id="addOperatorForm">
                    <div class="form-group">
                        <label for="operatorName">Nombre</label>
                        <input type="text" id="operatorName" required>
                    </div>
                    <div class="form-group">
                        <label for="operatorUsername">Usuario</label>
                        <input type="text" id="operatorUsername" required>
                    </div>
                    <div class="form-group">
                        <label for="operatorEmail">Email</label>
                        <input type="email" id="operatorEmail" required>
                    </div>
                    <div class="form-group">
                        <label for="operatorPassword">Contraseña</label>
                        <input type="password" id="operatorPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="operatorRole">Rol</label>
                        <select id="operatorRole" required>
                            <option value="operator">Operario</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Crear Operario</button>
                </form>
            </div>
        </div>
        ` : ''}
    `;
    
    loadOperatorsList();
}

async function loadOperatorsList() {
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const tbody = document.getElementById('operatorsTableBody');
        const isAdmin = currentUserData?.userRole === 'admin';
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}">No hay operarios registrados</td></tr>`;
            return;
        }
        
        tbody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.displayName || '-'}</td>
                <td>${data.username || '-'}</td>
                <td>${data.email || '-'}</td>
                <td>${data.role || 'operator'}</td>
                ${isAdmin ? `<td class="actions-cell">
                    <button class="btn btn-danger btn-small" onclick="deleteOperator('${doc.id}')">Eliminar</button>
                </td>` : ''}
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading operators:', error);
    }
}

// Load clients page
function loadClients() {
    const content = document.getElementById('pageContent');
    const canManage = ['admin', 'supervisor'].includes(currentUserData?.userRole);
    
    content.innerHTML = `
        <h1>Gestión de Clientes</h1>
        ${canManage ? '<button class="btn btn-primary" onclick="showAddClientModal()">Agregar Cliente</button>' : ''}
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Contacto</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        ${canManage ? '<th>Acciones</th>' : ''}
                    </tr>
                </thead>
                <tbody id="clientsTableBody">
                    <tr><td colspan="${canManage ? 5 : 4}">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
        
        ${canManage ? `
        <div id="addClientModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Agregar Cliente</h2>
                    <button class="close-modal" onclick="closeModal('addClientModal')">&times;</button>
                </div>
                <form id="addClientForm">
                    <div class="form-group">
                        <label for="clientName">Nombre</label>
                        <input type="text" id="clientName" required>
                    </div>
                    <div class="form-group">
                        <label for="clientContact">Contacto</label>
                        <input type="text" id="clientContact">
                    </div>
                    <div class="form-group">
                        <label for="clientPhone">Teléfono</label>
                        <input type="tel" id="clientPhone">
                    </div>
                    <div class="form-group">
                        <label for="clientEmail">Email</label>
                        <input type="email" id="clientEmail">
                    </div>
                    <div class="form-group">
                        <label for="clientAddress">Dirección</label>
                        <textarea id="clientAddress"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Crear Cliente</button>
                </form>
            </div>
        </div>
        ` : ''}
    `;
    
    loadClientsList();
}

async function loadClientsList() {
    try {
        const querySnapshot = await getDocs(collection(db, 'clients'));
        const tbody = document.getElementById('clientsTableBody');
        const canManage = ['admin', 'supervisor'].includes(currentUserData?.userRole);
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="${canManage ? 5 : 4}">No hay clientes registrados</td></tr>`;
            return;
        }
        
        tbody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.name || '-'}</td>
                <td>${data.contact || '-'}</td>
                <td>${data.phone || '-'}</td>
                <td>${data.email || '-'}</td>
                ${canManage ? `<td class="actions-cell">
                    <button class="btn btn-danger btn-small" onclick="deleteClient('${doc.id}')">Eliminar</button>
                </td>` : ''}
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Load objectives page
function loadObjectives() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <h1>Gestión de Objetivos</h1>
        <button class="btn btn-primary" onclick="showAddObjectiveModal()">Agregar Objetivo</button>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Cliente</th>
                        <th>Dirección</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="objectivesTableBody">
                    <tr><td colspan="4">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    
    loadObjectivesList();
}

async function loadObjectivesList() {
    try {
        const querySnapshot = await getDocs(collection(db, 'objectives'));
        const tbody = document.getElementById('objectivesTableBody');
        
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4">No hay objetivos registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            let clientName = '-';
            
            if (data.client_id) {
                try {
                    const clientDoc = await doc(db, 'clients', data.client_id);
                    const clientSnap = await getDoc(clientDoc);
                    if (clientSnap.exists()) {
                        clientName = clientSnap.data().name;
                    }
                } catch (e) {
                    console.error('Error fetching client:', e);
                }
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.name || '-'}</td>
                <td>${clientName}</td>
                <td>${data.address || '-'}</td>
                <td class="actions-cell">
                    <button class="btn btn-small btn-secondary" onclick="viewSectors('${docSnap.id}')">Ver Sectores</button>
                    <button class="btn btn-danger btn-small" onclick="deleteObjective('${docSnap.id}')">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading objectives:', error);
    }
}

// Load supplies page
function loadSupplies() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <h1>Gestión de Insumos</h1>
        <button class="btn btn-primary" onclick="showAddSupplyModal()">Agregar Insumo</button>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Unidad</th>
                        <th>Stock Actual</th>
                        <th>Stock Mínimo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="suppliesTableBody">
                    <tr><td colspan="6">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    
    loadSuppliesList();
}

async function loadSuppliesList() {
    try {
        const querySnapshot = await getDocs(collection(db, 'supplies'));
        const tbody = document.getElementById('suppliesTableBody');
        
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6">No hay insumos registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const isLow = data.quantity_in_stock <= data.min_stock_level;
            const status = isLow ? '<span style="color: red;">⚠️ Bajo</span>' : '<span style="color: green;">✓ OK</span>';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.name || '-'}</td>
                <td>${data.unit || '-'}</td>
                <td>${data.quantity_in_stock || 0}</td>
                <td>${data.min_stock_level || 0}</td>
                <td>${status}</td>
                <td class="actions-cell">
                    <button class="btn btn-small btn-secondary" onclick="updateStock('${doc.id}')">Actualizar Stock</button>
                    <button class="btn btn-danger btn-small" onclick="deleteSupply('${doc.id}')">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading supplies:', error);
    }
}

// Load cleaning page
function loadCleaning() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <h1>Registro de Limpieza</h1>
        <button class="btn btn-primary" onclick="showMarkCleaningModal()">Marcar Limpieza</button>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Objetivo</th>
                        <th>Sector</th>
                        <th>Operario</th>
                    </tr>
                </thead>
                <tbody id="cleaningTableBody">
                    <tr><td colspan="4">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    
    loadCleaningRecords();
}

async function loadCleaningRecords() {
    try {
        const q = query(collection(db, 'cleaning_records'), orderBy('cleaned_at', 'desc'));
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('cleaningTableBody');
        
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4">No hay registros de limpieza</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.cleaned_at ? new Date(data.cleaned_at.toDate()).toLocaleString('es-AR') : '-';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${data.objective_name || '-'}</td>
                <td>${data.sector_name || '-'}</td>
                <td>${data.operator_name || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading cleaning records:', error);
        document.getElementById('cleaningTableBody').innerHTML = '<tr><td colspan="4">Error al cargar registros</td></tr>';
    }
}

// Load messages page
function loadMessages() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <h1>Mensajes</h1>
        <button class="btn btn-primary" onclick="showNewMessageModal()">Nuevo Mensaje</button>
        
        <div class="message-list" id="messagesList">
            <p>Cargando mensajes...</p>
        </div>
    `;
    
    loadMessagesList();
}

async function loadMessagesList() {
    try {
        const q = query(
            collection(db, 'messages'),
            where('to_user_id', '==', currentUser.uid),
            orderBy('created_at', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const messagesList = document.getElementById('messagesList');
        
        if (querySnapshot.empty) {
            messagesList.innerHTML = '<p>No hay mensajes</p>';
            return;
        }
        
        messagesList.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.created_at ? new Date(data.created_at.toDate()).toLocaleString('es-AR') : '-';
            const unreadClass = data.read ? '' : 'unread';
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message-item ${unreadClass}`;
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-from">De: ${data.from_name || 'Usuario'}</span>
                    <span class="message-date">${date}</span>
                </div>
                <div class="message-text">${data.message}</div>
            `;
            messagesList.appendChild(messageDiv);
            
            // Mark as read when displayed
            if (!data.read) {
                updateDoc(doc(db, 'messages', doc.id), { read: true });
            }
        });
        
        loadUnreadMessages();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function loadUnreadMessages() {
    try {
        const q = query(
            collection(db, 'messages'),
            where('to_user_id', '==', currentUser.uid),
            where('read', '==', false)
        );
        
        const querySnapshot = await getDocs(q);
        const count = querySnapshot.size;
        const badge = document.getElementById('unreadCount');
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading unread messages:', error);
    }
}

// Load reports page
function loadReports() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <h1>Reportes</h1>
        <div class="card">
            <h3>Reportes Disponibles</h3>
            <p>Funcionalidad de reportes en desarrollo</p>
        </div>
    `;
}

// Modal functions
window.showAddOperatorModal = function() {
    document.getElementById('addOperatorModal').classList.add('active');
};

window.showAddClientModal = function() {
    document.getElementById('addClientModal').classList.add('active');
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

// Delete functions
window.deleteOperator = async function(id) {
    if (confirm('¿Está seguro de eliminar este operario?')) {
        try {
            await deleteDoc(doc(db, 'users', id));
            loadOperatorsList();
        } catch (error) {
            console.error('Error deleting operator:', error);
            alert('Error al eliminar operario');
        }
    }
};

window.deleteClient = async function(id) {
    if (confirm('¿Está seguro de eliminar este cliente?')) {
        try {
            await deleteDoc(doc(db, 'clients', id));
            loadClientsList();
        } catch (error) {
            console.error('Error deleting client:', error);
            alert('Error al eliminar cliente');
        }
    }
};

window.deleteObjective = async function(id) {
    if (confirm('¿Está seguro de eliminar este objetivo?')) {
        try {
            await deleteDoc(doc(db, 'objectives', id));
            loadObjectivesList();
        } catch (error) {
            console.error('Error deleting objective:', error);
            alert('Error al eliminar objetivo');
        }
    }
};

window.deleteSupply = async function(id) {
    if (confirm('¿Está seguro de eliminar este insumo?')) {
        try {
            await deleteDoc(doc(db, 'supplies', id));
            loadSuppliesList();
        } catch (error) {
            console.error('Error deleting supply:', error);
            alert('Error al eliminar insumo');
        }
    }
};

// Form submissions
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'addClientForm') {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'clients'), {
                name: document.getElementById('clientName').value,
                contact: document.getElementById('clientContact').value,
                phone: document.getElementById('clientPhone').value,
                email: document.getElementById('clientEmail').value,
                address: document.getElementById('clientAddress').value,
                created_at: new Date()
            });
            closeModal('addClientModal');
            e.target.reset();
            loadClientsList();
        } catch (error) {
            console.error('Error adding client:', error);
            alert('Error al agregar cliente');
        }
    }
});

// Load dashboard on page load
loadPage('dashboard');
