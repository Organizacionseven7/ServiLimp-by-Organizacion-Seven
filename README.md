# ServiLimp-by-Organizacion-Seven

App de Limpieza - Sistema de Gestión para Empresas de Limpieza

## Características

- 🔐 Autenticación con Firebase Authentication
- 👥 Gestión de operarios, supervisores y administradores
- 🏢 Gestión de clientes y objetivos
- 📦 Control de inventario de insumos
- 🧹 Registro de actividades de limpieza
- 💬 Sistema de mensajería entre operarios y supervisores
- 📊 Dashboard con estadísticas en tiempo real
- ☁️ Base de datos en la nube con Firebase Firestore

## Tecnologías

- **Backend**: Node.js + Express
- **Frontend**: HTML5, CSS3, JavaScript (ES6 Modules)
- **Base de Datos**: Firebase Firestore
- **Autenticación**: Firebase Authentication

## Instalación

1. Clonar el repositorio
```bash
git clone https://github.com/Organizacionseven7/ServiLimp-by-Organizacion-Seven.git
cd ServiLimp-by-Organizacion-Seven
```

2. Instalar dependencias
```bash
npm install
```

3. Iniciar el servidor
```bash
npm start
```

4. Abrir en el navegador
```
http://localhost:3000
```

## Credenciales por Defecto

- **Usuario**: admin@servilimp.local
- **Contraseña**: admin123

## Configuración de Firebase

La aplicación está configurada para usar el proyecto Firebase:
- Project ID: servilimp-8b5df
- Los datos se almacenan en Firestore
- La autenticación usa Firebase Auth

## Estructura del Proyecto

```
├── public/
│   ├── css/
│   │   └── style.css       # Estilos de la aplicación
│   ├── js/
│   │   ├── firebase-config.js  # Configuración de Firebase
│   │   ├── login.js        # Lógica de login
│   │   └── app.js          # Aplicación principal
│   ├── index.html          # Página de login
│   └── dashboard.html      # Dashboard principal
├── server.js               # Servidor Express
├── package.json           # Dependencias del proyecto
└── README.md              # Este archivo
```

## Roles de Usuario

- **Admin**: Acceso completo a todas las funcionalidades
- **Supervisor**: Puede gestionar operarios, clientes, objetivos e insumos
- **Operario**: Puede registrar limpiezas, agregar observaciones y enviar mensajes

## Funcionalidades por Módulo

### Gestión de Operarios
- Crear, ver y eliminar operarios
- Asignar roles (operario, supervisor, admin)

### Gestión de Clientes
- Registrar información de clientes
- Datos de contacto y dirección

### Gestión de Objetivos
- Crear objetivos/ubicaciones de limpieza
- Asociar objetivos con clientes
- Gestionar sectores dentro de cada objetivo

### Control de Insumos
- Registrar insumos y productos de limpieza
- Control de stock actual y niveles mínimos
- Alertas de stock bajo

### Registro de Limpieza
- Marcar sectores como limpios
- Agregar observaciones
- Historial de actividades

### Mensajería
- Comunicación entre operarios y supervisores
- Notificaciones de mensajes no leídos

## Desarrollo

Para desarrollo con recarga automática:
```bash
npm install -g nodemon
npm run dev
```

## Licencia

ISC

