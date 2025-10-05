# BloomWatch

BloomWatch es una aplicación diseñada para ayudar a los agricultores a monitorear la salud de sus cultivos utilizando datos satelitales y análisis de vigor.

## Prerrequisitos

Asegúrate de tener Node.js y npm instalados en tu sistema.

## Instalación

Sigue estos pasos para configurar el entorno de desarrollo.

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd bloomWatch
```

### 2. Configurar el Back-End

Navega al directorio del servidor e instala las dependencias.

```bash
cd BackEnd/server
npm install
```

### 3. Configurar el Front-End

Navega al directorio del cliente e instala las dependencias.

```bash
cd ../../FrontEnd/client
npm install
```

## Cómo Ejecutar la Aplicación

Para ejecutar la aplicación, necesitarás iniciar tanto el back-end como el front-end en terminales separadas.

### Iniciar el Servidor Back-End

En una terminal, navega al directorio del servidor y ejecuta:

```bash
cd BackEnd/server
npm run dev
```

El servidor se iniciará en modo de desarrollo y se reiniciará automáticamente si se detectan cambios en los archivos.

### Iniciar la Aplicación Front-End

En otra terminal, navega al directorio del cliente y ejecuta:

```bash
cd FrontEnd/client
npm run dev
```

La aplicación de React se iniciará y debería abrirse automáticamente en tu navegador web.