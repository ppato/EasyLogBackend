const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  level: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  service: String,
  app: String,
  companyId: String,
  message: String,
  context: Object,
  url: String, // ✅ Agregar esta línea
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Log', logSchema);
// Exportamos el modelo Log para usarlo en los controladores
// Asegúrate de que el esquema tenga los campos necesarios y que la conexión a MongoDB esté configurada correctamente en tu aplicación.
// Este modelo se usará para crear, leer y manipular logs en la base de datos.
// También puedes agregar validaciones adicionales según tus necesidades específicas.
// Por ejemplo, puedes agregar validaciones para los campos 'message', 'context', etc.,
// o incluso agregar índices para mejorar el rendimiento de las consultas.
// Además, asegúrate de que el campo 'userId' esté referenciado correctamente al modelo 'User' si estás usando Mongoose para manejar usuarios.
// Esto permitirá que puedas hacer consultas y referencias entre logs y usuarios fácilmente.
// También puedes considerar agregar un índice en 'companyId' si planeas hacer muchas consultas basadas en este campo,
// lo que mejorará el rendimiento de las búsquedas por empresa.
// Por último, asegúrate de manejar adecuadamente los errores y excepciones al interact
//uar con la base de datos, especialmente al guardar logs o al realizar consultas.
// Esto te ayudará a mantener la integridad de los datos y a depurar problemas más fácilmente.
// Puedes usar middlewares de Mongoose para manejar errores globalmente o en cada operación específica.
// También es recomendable agregar un índice en el campo 'timestamp' si planeas hacer consultas basadas en el tiempo,
// lo que mejorará el rendimiento de las consultas que filtren por rango de tiempo.
// Por ejemplo, puedes agregar un índice así:
// logSchema.index({ timestamp: 1 });
// Esto permitirá que las consultas que filtren por 'timestamp' sean más rápidas, especialmente si tienes una gran cantidad de logs.
// Recuerda que los índices pueden aumentar el rendimiento de las consultas,
// pero también pueden afectar el rendimiento de las operaciones de escritura, así que úsalos sabiamente.
// Además, si planeas almacenar logs por un período prolongado, considera implementar una estrategia de
// rotación o archivado de logs para mantener el tamaño de la base de datos manejable.