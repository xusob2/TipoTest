require('dotenv').config();

const express = require('express');
const cors = require('cors');
// ⭐️ IMPORTAR PATH para servir archivos estáticos
const path = require('path'); 
const { Question, Score, Report } = require('./db');
const app = express();
const PORT = process.env.PORT || 3000; // ⭐️ Usar el puerto de Render o el 3000

// --- Middlewares ---
app.use(cors()); // Permite peticiones de tu frontend
app.use(express.json()); // Permite a Express leer cuerpos JSON en las peticiones POST/PUT

// --- RUTAS API DE GESTIÓN DE MÓDULOS (CRUD ADMINISTRATIVO) ---

/**
 * Endpoint para crear un nuevo módulo (subir preguntas desde un JSON).
 * El body debe ser un array de objetos de preguntas.
 */
app.post('/api/admin/create-module', async (req, res) => {
    try {
        const questionsArray = req.body; // Se espera un array de preguntas

        if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
            return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un array de preguntas no vacío.' });
        }
        
        // Asumiendo que el moduleName es consistente en todas las preguntas
        const moduleName = questionsArray[0].moduleName; 

        // 1. Eliminar preguntas existentes para este módulo (opcional: limpiar antes de recargar)
        await Question.deleteMany({ moduleName: moduleName });
        
        // 2. Insertar las nuevas preguntas
        const result = await Question.insertMany(questionsArray);
        
        res.status(201).json({ 
            message: `Módulo '${moduleName}' guardado exitosamente.`, 
            count: result.length 
        });

    } catch (error) {
        console.error('Error al subir preguntas:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar las preguntas.' });
    }
});

/**
 * Endpoint para eliminar un módulo completo.
 */
app.delete('/api/admin/module/:moduleName', async (req, res) => {
    try {
        const { moduleName } = req.params;

        // 1. Eliminar todas las preguntas del módulo
        await Question.deleteMany({ moduleName });

        // 2. Eliminar todas las puntuaciones para ese módulo (opcional)
        await Score.deleteMany({ moduleName });

        // 3. Eliminar todos los reportes (opcional)
        await Report.deleteMany({ moduleName });

        res.status(200).json({ 
            message: `Módulo '${moduleName}' y sus datos asociados eliminados correctamente.` 
        });

    } catch (error) {
        console.error('Error al eliminar módulo:', error);
        res.status(500).json({ message: 'Error interno del servidor al eliminar el módulo.' });
    }
});

// --- RUTAS API DE QUIZ Y PUNTUACIÓN ---

/**
 * Endpoint para obtener la lista de módulos (temas) disponibles.
 */
app.get('/api/modules', async (req, res) => {
    try {
        // Encontrar todos los nombres de módulos únicos
        const modules = await Question.distinct('moduleName');
        res.json({ modules });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los módulos.' });
    }
});

/**
 * Endpoint para cargar un quiz: obtener preguntas mezcladas para un tema.
 */
app.get('/api/quiz/:moduleName', async (req, res) => {
    try {
        const { moduleName } = req.params;
        
        // 1. Obtener todas las preguntas del módulo
        let questions = await Question.find({ moduleName }).select('-__v'); // Excluir campo de mongoose
        
        if (questions.length === 0) {
            return res.status(404).json({ message: 'Módulo no encontrado o sin preguntas.' });
        }
        
        // 2. Mezclar el orden de las preguntas (shuffle)
        questions = questions.sort(() => Math.random() - 0.5);
        
        // 3. Devolver las preguntas
        res.json({ moduleName, questions });
        
    } catch (error) {
        console.error('Error al cargar quiz:', error);
        res.status(500).json({ message: 'Error interno del servidor al cargar el quiz.' });
    }
});

/**
 * Endpoint para guardar el resultado de un intento de quiz.
 */
app.post('/api/scores', async (req, res) => {
    try {
        const { moduleName, userName, correctCount, incorrectCount } = req.body;
        
        const totalQuestions = correctCount + incorrectCount;
        const percentage = (correctCount / totalQuestions) * 100;

        const newScore = new Score({
            moduleName,
            userName,
            correctCount,
            incorrectCount,
            totalQuestions,
            percentage: parseFloat(percentage.toFixed(2)) // Redondear a 2 decimales
        });

        await newScore.save();

        res.status(201).json({ message: 'Puntuación guardada exitosamente.', score: newScore });

    } catch (error) {
        console.error('Error al guardar puntuación:', error);
        res.status(500).json({ message: 'Error interno del servidor al guardar la puntuación.' });
    }
});


// ------------------------------------------------------------------
// ⭐️ CÓDIGO AÑADIDO PARA EL DESPLIEGUE FULL-STACK EN RENDER ⭐️
// ------------------------------------------------------------------

// ⚠️ Asegúrate de que esta carpeta sea donde tienes tu index.html
const FRONTEND_DIR = path.join(__dirname, 'www'); 

// 1. Servir archivos estáticos
// Esto permite que Express sirva HTML, CSS, JS, imágenes, etc., desde la carpeta 'www'
app.use(express.static(FRONTEND_DIR));

// 2. Ruta comodín (Fallback)
// Si ninguna de las rutas API anteriores coincide, enviamos el index.html.
// Esto es necesario para que el frontend se cargue cuando se accede a la raíz del dominio.
app.get('*', (req, res) => {
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    res.sendFile(indexPath);
});


// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor Express.js iniciado en http://localhost:${PORT}`);
    console.log('API lista para recibir peticiones...');
});