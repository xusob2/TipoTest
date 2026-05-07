const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quizdb';

// 1. Esquema de Pregunta Actualizado
const QuestionSchema = new mongoose.Schema({
    groupName: { type: String, default: 'General' },
    moduleName: { type: String, required: true },
    question: { type: String, required: true },
    type: { type: String, enum: ['choice', 'text'], default: 'choice' },
    options: [{ type: String }],
    correct: { type: Number },
    correctAnswerText: { type: String },
    explanation: { type: String, default: 'No hay explicación disponible.' }
});

// 2. Esquema de Puntuación (Scores)
const ScoreSchema = new mongoose.Schema({
    moduleName: { type: String, required: true },
    userName: { type: String, required: true, default: 'Anónimo' },
    date: { type: Date, default: Date.now },
    correctCount: { type: Number, required: true },
    incorrectCount: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true }
});

// 3. Esquema de Reportes
const ReportSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    moduleName: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pendiente', 'Revisada', 'Eliminada'], default: 'Pendiente' },
    reportCount: { type: Number, default: 1 },
    date: { type: Date, default: Date.now }
});

// 4. Nuevo esquema para récords perfectos
const PerfectRunSchema = new mongoose.Schema({
    moduleName: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 }
});

// Conexión a Mongoose
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conexión a MongoDB exitosa.'))
    .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// ÚNICO EXPORT AL FINAL
module.exports = {
    Question: mongoose.model('Question', QuestionSchema),
    Score: mongoose.model('Score', ScoreSchema),
    Report: mongoose.model('Report', ReportSchema),
    PerfectRun: mongoose.model('PerfectRun', PerfectRunSchema)
};