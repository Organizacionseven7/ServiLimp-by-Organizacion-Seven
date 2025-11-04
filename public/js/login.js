// Login functionality with Firebase Authentication
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('error-message');

// Handle login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Convert username to email format for Firebase
    const email = username.includes('@') ? username : `${username}@servilimp.local`;
    
    try {
        errorMessage.style.display = 'none';
        
        // Sign in with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Get user role from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let userData = { role: 'operator', displayName: username };
        
        if (userDoc.exists()) {
            userData = userDoc.data();
        }
        
        // Set session on server
        const response = await fetch('/api/set-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                role: userData.role,
                displayName: userData.displayName || username
            })
        });
        
        if (response.ok) {
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            throw new Error('Failed to create session');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'Usuario o contraseña incorrectos';
        errorMessage.style.display = 'block';
    }
});

// Create default admin user if it doesn't exist
async function createDefaultAdmin() {
    try {
        const adminEmail = 'admin@servilimp.local';
        const adminPassword = 'admin123';
        
        // Check if admin exists
        const adminDoc = await getDoc(doc(db, 'users', 'admin'));
        
        if (!adminDoc.exists()) {
            // Try to create admin user
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    username: 'admin',
                    displayName: 'Administrator',
                    email: adminEmail,
                    role: 'admin',
                    createdAt: new Date().toISOString()
                });
                console.log('Default admin user created');
            } catch (createError) {
                // Admin might already exist, ignore error
                console.log('Admin user might already exist');
            }
        }
    } catch (error) {
        console.log('Error checking/creating admin:', error.message);
    }
}

// Try to create default admin on page load
createDefaultAdmin();
