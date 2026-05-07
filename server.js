require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); 
const { Question, Score, Report } = require('./db');
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
        const updatedQ = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

// Subida masiva mediante JSON
app.post('/api/admin/create-module', async (req, res) => {
    try {
        const questionsArray = req.body; 
        if (!Array.isArray(questionsArray) || questionsArray.length === 0) return res.status(400).json({ message: 'Array vacío.' });
        const moduleName = questionsArray[0].moduleName; 
        await Question.deleteMany({ moduleName: moduleName });
        const result = await Question.insertMany(questionsArray);
        res.status(201).json({ message: `Módulo '${moduleName}' guardado.`, count: result.length });
    } catch (error) {
        res.status(500).json({ message: 'Error al procesar JSON.' });
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