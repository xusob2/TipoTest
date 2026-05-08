require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); 
const { Question, Score, Report,PerfectRun,Fallo,LastPlayed } = require('./db');
const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json()); 

// --- RUTAS DE LECTURA (MENÚ Y QUIZ) ---

// Obtener menú dinámico (agrupado por groupName y moduleName)
app.get('/api/menu', async (req, res) => {
    try {
        const menu = await Question.aggregate([
            { $group: { _id: { group: "$groupName", module: "$moduleName" }, count: { $sum: 1 } } },
            { $sort: { "_id.module": 1 } },
            { $group: { _id: "$_id.group", modules: { $push: { name: "$_id.module", count: "$count" } } } },
            { $sort: { "_id": 1 } } // Ordenar grupos alfabéticamente
        ]);
        res.json(menu);
    } catch (error) {
        res.status(500).json({ message: 'Error al cargar el menú.' });
    }
});

// Obtener preguntas para jugar (mezcladas)
app.get('/api/quiz/:moduleName', async (req, res) => {
    try {
        const { moduleName } = req.params;
        let questions = await Question.find({ moduleName }).select('-__v'); 
        if (questions.length === 0) return res.status(404).json({ message: 'Módulo sin preguntas.' });
        
        questions = questions.sort(() => Math.random() - 0.5);
        res.json({ moduleName, questions });
    } catch (error) {
        res.status(500).json({ message: 'Error al cargar el quiz.' });
    }
});

// Guardar Puntuación
app.post('/api/scores', async (req, res) => {
    try {
        const { moduleName, userName, correctCount, incorrectCount } = req.body;
        const totalQuestions = correctCount + incorrectCount;
        const percentage = (correctCount / totalQuestions) * 100;

        const newScore = new Score({
            moduleName, userName, correctCount, incorrectCount, totalQuestions,
            percentage: parseFloat(percentage.toFixed(2))
        });
        await newScore.save();
        res.status(201).json({ message: 'Puntuación guardada.', score: newScore });
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar la puntuación.' });
    }
});

// --- RUTAS DE ADMINISTRACIÓN (CRUD DE PREGUNTAS) ---

// Obtener todas las preguntas de un módulo específico (para editar)
app.get('/api/admin/questions/:moduleName', async (req, res) => {
    try {
        const questions = await Question.find({ moduleName: req.params.moduleName });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener preguntas.' });
    }
});

// Crear una pregunta individual
app.post('/api/admin/question', async (req, res) => {
    try {
        const newQ = new Question(req.body);
        await newQ.save();
        res.status(201).json({ message: 'Pregunta añadida.', question: newQ });
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar pregunta.' });
    }
});


// Actualizar una pregunta existente
app.put('/api/admin/question/:id', async (req, res) => {
    try {
        // Hemos cambiado { new: true } por { returnDocument: 'after' }
        const updatedQ = await Question.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        res.json({ message: 'Pregunta actualizada.', question: updatedQ });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar.' });
    }
});

// Borrar una pregunta individual
app.delete('/api/admin/question/:id', async (req, res) => {
    try {
        await Question.findByIdAndDelete(req.params.id);
        res.json({ message: 'Pregunta eliminada.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar.' });
    }
});
// Borrar un MÓDULO entero (todas sus preguntas)
app.delete('/api/admin/module/:moduleName', async (req, res) => {
    try {
        const { moduleName } = req.params;
        const result = await Question.deleteMany({ moduleName });
        res.json({ message: `Se han eliminado ${result.deletedCount} preguntas del módulo ${moduleName}.` });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el módulo completo.' });
    }
});
// Borrar un GRUPO entero (todas sus preguntas y módulos asociados)
app.delete('/api/admin/group/:groupName', async (req, res) => {
    try {
        const { groupName } = req.params;
        const result = await Question.deleteMany({ groupName });
        res.json({ message: `Se han eliminado ${result.deletedCount} preguntas del grupo ${groupName}.` });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el grupo completo.' });
    }
});
// Subida masiva mediante JSON
app.post('/api/admin/create-module', async (req, res) => {
    try {
        const questionsArray = req.body; 
        if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
            return res.status(400).json({ message: 'Array vacío.' });
        }
        
        // Sacamos una lista de TODOS los nombres de módulos que han llegado 
        // Ej: ["Meterpreter (Parte 1)", "Meterpreter (Parte 2)"]
        const uniqueModules = [...new Set(questionsArray.map(q => q.moduleName))];
        
        // Borramos todos esos módulos en la base de datos para evitar duplicados si estás resubiendo
        await Question.deleteMany({ moduleName: { $in: uniqueModules } });
        
        // Insertamos el nuevo array ya procesado
        const result = await Question.insertMany(questionsArray);
        
        res.status(201).json({ message: `Módulos guardados con éxito.`, count: result.length });
    } catch (error) {
        console.error("Error procesando JSON:", error);
        res.status(500).json({ message: 'Error al procesar JSON en el servidor.' });
    }
});
app.get('/api/perfect-runs', async (req, res) => {
    try {
        const runs = await PerfectRun.find();
        // Convertimos el array de la DB en un objeto fácil de usar para el JS: { "Meterpreter": 3, "Nmap": 1 }
        const runsObj = {};
        runs.forEach(r => runsObj[r.moduleName] = r.count);
        res.json(runsObj);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener récords.' });
    }
});

// Incrementar récord perfecto de un módulo
app.post('/api/perfect-runs/:moduleName', async (req, res) => {
    try {
        const { moduleName } = req.params;
        // Si no existe lo crea, si existe le suma 1 al contador
        const record = await PerfectRun.findOneAndUpdate(
            { moduleName },
            { $inc: { count: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        res.json(record);
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar récord.' });
    }
});

// Obtener todos los fallos
app.get('/api/fallos', async (req, res) => {
    try {
        const fallos = await Fallo.find();
        // Devolvemos solo el interior (la pregunta en sí)
        res.json(fallos.map(f => f.questionData));
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener fallos.' });
    }
});

// Guardar un fallo nuevo
app.post('/api/fallos', async (req, res) => {
    try {
        await Fallo.findOneAndUpdate(
            { questionId: req.body._id },
            { questionId: req.body._id, questionData: req.body },
            { upsert: true }
        );
        res.status(200).json({ message: 'Fallo guardado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar fallo.' });
    }
});

// Borrar un fallo (cuando le das a "Ya me la sé")
app.delete('/api/fallos/:id', async (req, res) => {
    try {
        await Fallo.findOneAndDelete({ questionId: req.params.id });
        res.status(200).json({ message: 'Fallo eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar fallo.' });
    }
});

// --- RUTAS DE ÚLTIMA VEZ JUGADO ---
app.get('/api/last-played', async (req, res) => {
    try {
        const records = await LastPlayed.find();
        const result = {};
        records.forEach(r => result[r.moduleName] = r.date);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error obteniendo fechas.' });
    }
});

app.post('/api/last-played', async (req, res) => {
    try {
        const { moduleName, groupName } = req.body;
        const record = await LastPlayed.findOneAndUpdate(
            { moduleName },
            { moduleName, groupName, date: new Date() },
            { upsert: true, returnDocument: 'after' }
        );
        res.json({ date: record.date });
    } catch (error) {
        res.status(500).json({ message: 'Error guardando fecha.' });
    }
});



// --- FRONTEND ESTÁTICO ---
const FRONTEND_DIR = path.join(__dirname, 'www'); 
app.use(express.static(FRONTEND_DIR));
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    }
    next();
});

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));