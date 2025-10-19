// controllers/insights.controller.js
const Log = require('../models/log.model');

/* ------------------------------ Helpers ------------------------------ */

function parseDateOr(value, fallback) {
  const d = value ? new Date(value) : null;
  return d && !isNaN(d.getTime()) ? d : fallback;
}

// p95 en JS (evita depender de $percentile de Mongo 7+)
function p95(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  return sorted[idx];
}

function normalizeTo100(arr = []) {
  const max = Math.max(1, ...arr);
  return arr.map(v => Math.round((v / max) * 100));
}

function pick(obj, keys) {
  return keys.reduce((acc, k) => (obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});
}

/* ------------------------------ Core logic ------------------------------ */
/**
 * GET /api/insights
 * Query:
 *  - from, to (ISO). Si no vienen: window = últimos 60 minutos
 *  - unit: 'hour' | 'day'  (para trend y baseline). Default 'hour'
 *  - buckets: cantidad de barras del trend (default 7)
 *  - app, service, level: filtros opcionales
 *
 * Respuesta:
 *  {
 *    summary: { total, critical, warning, info },
 *    highlights: [ {title, app, service, message, level, type, currentCount, p95, ratio, trend[]} ],
 *    insights:   [ {timestamp, app, service, message, type, level} ]
 *  }
 */
exports.getInsights = async (req, res) => {
  try {
    // Autorización (igual a tus otros controladores)
    const companyKey = req.user?.companyId || req.companyId;
    if (!companyKey) return res.status(401).json({ message: 'Unauthorized' });

    // Parámetros de rango y unidad
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 60 * 60 * 1000); // 60 min
    const from = parseDateOr(req.query.from, defaultFrom);
    const to = parseDateOr(req.query.to, now);

    const unit = (req.query.unit === 'day' ? 'day' : 'hour');
    const buckets = Math.max(2, Math.min(parseInt(req.query.buckets || '7', 10), 30));

    // Rango de baseline (7 unidades hacia atrás)
    const baselineSpanMs = unit === 'day'
      ? 7 * 24 * 60 * 60 * 1000
      : 7 * 60 * 60 * 1000;

    const baselineFrom = new Date(from.getTime() - baselineSpanMs);

    // Filtros opcionales
    const baseMatch = {
      companyId: companyKey,
      ...(req.query.app ? { app: req.query.app } : {}),
      ...(req.query.service ? { service: req.query.service } : {}),
      ...(req.query.level ? { level: req.query.level } : {}),
    };

    // Helper para $dateTrunc según unidad
    const dateTrunc = {
      $dateTrunc: {
        date: '$timestamp',
        unit: unit, // 'hour' | 'day'
      }
    };

    /* ------------------------------ Aggregation ------------------------------ */
    const pipeline = [
      { $match: baseMatch },
      {
        $facet: {
          /* 1) Conteos actuales por clave (ventana seleccionada) */
          currentWindow: [
            { $match: { timestamp: { $gte: from, $lt: to } } },
            {
              $group: {
                _id: { app: '$app', service: '$service', level: '$level' },
                currentCount: { $sum: 1 },
                lastMessage: { $last: '$message' }, // para mostrar algo legible
                lastTs: { $last: '$timestamp' }
              }
            }
          ],

          /* 2) Baseline por clave con buckets de tiempo (7 intervalos previos) */
          baselineWindow: [
            { $match: { timestamp: { $gte: baselineFrom, $lt: from } } },
            {
              $group: {
                _id: {
                  app: '$app',
                  service: '$service',
                  level: '$level',
                  bucket: dateTrunc
                },
                c: { $sum: 1 }
              }
            },
            {
              $group: {
                _id: { app: '$_id.app', service: '$_id.service', level: '$_id.level' },
                counts: { $push: '$c' }, // arreglo de conteos para p95
                sum: { $sum: '$c' },
                avg: { $avg: '$c' }
              }
            }
          ],

          /* 3) Trend (últimos N buckets, incluyendo la ventana actual) */
          trendBuckets: [
            { $match: { timestamp: { $gte: new Date(to.getTime() - buckets * (unit === 'day' ? 24 : 1) * 60 * 60 * 1000), $lt: to } } },
            {
              $group: {
                _id: {
                  app: '$app',
                  service: '$service',
                  level: '$level',
                  bucket: dateTrunc
                },
                c: { $sum: 1 }
              }
            }
          ],

          /* 4) Conteo por nivel para los cards de arriba */
          summaryLevels: [
            { $match: { timestamp: { $gte: from, $lt: to } } },
            {
              $group: {
                _id: '$level',
                count: { $sum: 1 }
              }
            }
          ],

          /* 5) Tabla “insights del período” (muestras con metadatos) */
          tableRows: [
            { $match: { timestamp: { $gte: from, $lt: to } } },
            {
              $project: {
                _id: 0,
                timestamp: 1,
                app: 1,
                service: 1,
                message: 1,
                level: 1
              }
            },
            { $sort: { timestamp: -1 } },
            { $limit: 200 }
          ]
        }
      }
    ];

    const [result] = await Log.aggregate(pipeline);

    const currentMap = new Map();      // key -> { currentCount, lastMessage, lastTs }
    const baselineMap = new Map();     // key -> { counts[], avg }
    const trendMap = new Map();        // key -> Map(bucketISO -> c)

    // Helpers de claves
    const keyOf = (o) => `${o.app || ''}|${o.service || ''}|${o.level || ''}`;

    // 1) currentWindow
    for (const row of result.currentWindow || []) {
      const key = keyOf(row._id || {});
      currentMap.set(key, {
        app: row._id.app, service: row._id.service, level: row._id.level,
        currentCount: row.currentCount || 0,
        lastMessage: row.lastMessage || '',
        lastTs: row.lastTs || to
      });
    }

    // 2) baselineWindow
    for (const row of result.baselineWindow || []) {
      const key = keyOf(row._id || {});
      baselineMap.set(key, {
        app: row._id.app, service: row._id.service, level: row._id.level,
        counts: row.counts || [],
        avg: row.avg || 0
      });
    }

    // 3) trendBuckets
    // Convertimos a un mapa por key y bucket-iso
    for (const row of result.trendBuckets || []) {
      const key = keyOf(row._id || {});
      const bucket = row._id.bucket instanceof Date
        ? row._id.bucket.toISOString()
        : new Date(row._id.bucket).toISOString();

      if (!trendMap.has(key)) trendMap.set(key, new Map());
      trendMap.get(key).set(bucket, row.c || 0);
    }

    /* ------------------------------ Construcción de highlights ------------------------------ */
    // Para cada clave presente en current o baseline armamos el insight
    const allKeys = new Set([...currentMap.keys(), ...baselineMap.keys()]);

    const highlightCandidates = [];

    for (const key of allKeys) {
      const cur = currentMap.get(key) || {};
      const base = baselineMap.get(key) || {};
      const p95value = p95(base.counts || []);

      // Trend: últimos N buckets cronológicos
      // Construimos las etiquetas de buckets (N) terminando en 'to' (exclusivo)
      const labels = [];
      const stepMs = unit === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
      for (let i = buckets - 1; i >= 0; i--) {
        const end = new Date(to.getTime() - i * stepMs);
        // $dateTrunc-equivalente: truncamos a inicio de unidad
        const trunc = unit === 'day'
          ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
          : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), end.getUTCHours()));
        labels.push(trunc.toISOString());
      }
      const tMap = trendMap.get(key) || new Map();
      const rawTrend = labels.map(l => tMap.get(l) || 0);
      const trend = normalizeTo100(rawTrend);

      const isSpike = cur.currentCount > p95value && p95value > 0;
      const ratio = p95value > 0 ? cur.currentCount / p95value : 0;

      // Solo generamos highlight si hay actividad actual o spike
      if (cur.currentCount > 0 || isSpike) {
        const [app, service, level] = key.split('|');
        highlightCandidates.push({
          title: isSpike ? 'Spike detectado' : 'Actividad destacada',
          app,
          service,
          message: cur.lastMessage || 'Actividad reciente',
          level: level || 'info',
          type: isSpike ? 'Spike' : 'Activity',
          currentCount: cur.currentCount || 0,
          p95: p95value || 0,
          ratio: Number(ratio.toFixed(2)),
          trend
        });
      }
    }

    // Orden: primero spikes por mayor ratio, luego actividad por currentCount
    const highlights = highlightCandidates
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'Spike' ? -1 : 1;
        if (a.type === 'Spike') return (b.ratio || 0) - (a.ratio || 0);
        return (b.currentCount || 0) - (a.currentCount || 0);
      })
      .slice(0, 3);

    /* ------------------------------ Summary (cards) ------------------------------ */
    const levelCount = { critical: 0, warning: 0, info: 0, other: 0 };
    for (const row of result.summaryLevels || []) {
      const lvl = (row._id || '').toLowerCase();
      if (lvl === 'critical' || lvl === 'warning' || lvl === 'info') {
        levelCount[lvl] += row.count || 0;
      } else {
        levelCount.other += row.count || 0;
      }
    }
    const summary = {
      total: levelCount.critical + levelCount.warning + levelCount.info + levelCount.other,
      critical: levelCount.critical,
      warning: levelCount.warning,
      info: levelCount.info
    };

    /* ------------------------------ Tabla del período ------------------------------ */
    const insightsTable = (result.tableRows || []).map(r => ({
      timestamp: r.timestamp,
      app: r.app,
      service: r.service,
      message: r.message,
      type: 'Pattern', // placeholder: puedes clasificar luego (Spike/Pattern/Anomaly)
      level: r.level
    }));

    /* ------------------------------ Respuesta ------------------------------ */
    return res.json({
      range: { from, to, unit, buckets },
      summary,
      highlights,
      insights: insightsTable
    });

  } catch (err) {
    console.error('Error en /api/insights:', err);
    return res.status(500).json({ message: 'Error calculando insights' });
  }
};

/**
 * (Opcional) GET /api/insights/spikes
 * Devuelve SOLO los spikes (útil si quieres una ruta dedicada).
 */
exports.getSpikesOnly = async (req, res) => {
  // Puedes simplemente llamar a getInsights y filtrar highlights type === 'Spike'
  req.query = { ...(req.query || {}), buckets: req.query.buckets || 7 };
  const resCapture = {
    status: () => res,
    json: (data) => {
      return res.json({
        ...pick(data, ['range', 'summary']),
        highlights: (data.highlights || []).filter(h => h.type === 'Spike')
      });
    }
  };
  return exports.getInsights(req, resCapture);
};
