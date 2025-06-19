const express = require('express');
const vision = require('@google-cloud/vision');
const { v2: translate } = require('@google-cloud/translate');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const keyFilename = path.join(__dirname, 'credencialesAPI.json');

const clientVision = new vision.ImageAnnotatorClient({ keyFilename });
const clientTranslate = new translate.Translate({ keyFilename });

// Lista de alimentos (en forma canónica)
const foodKeywords = [
  'manzana', 'plátano', 'banana', 'banano', 'hamburguesa', 'zanahoria', 'patata', 'papa',
  'pastel', 'sándwich', 'pasta', 'bistec', 'sushi', 'pan', 'queso', 'chocolate', 'huevo',
  'pescado', 'pollo', 'tomate', 'cebolla', 'helado', 'café', 'té', 'carne', 'arroz',
  'sopa', 'fresa', 'limón', 'citrón', 'mora', 'perejil', 'ajo', 'berenjena'
];

// Mapeo de sinónimos hacia una forma estándar
const synonymMap = {
  'banana': 'plátano',
  'banano': 'plátano',
  'musa': 'plátano',
  'frutilla': 'fresa',
  'citrón': 'limón',
  'lemón': 'limón',
  'papa': 'patata',
  'baya': 'fruta del bosque', 
  'baya': 'frambuesa', 
  'strawberry': 'fresa',
  'parsley': 'perejil',
  'carne' : 'pollo',
  'verdura de hoja': 'perejil',
};

// Función para normalizar palabras (acentos, minúsculas, quitar plural)
const normalize = text => {
  return text
    .toLowerCase()
    // .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/s$/, '') // quitar plural simple
    .trim();
};

app.post('/detectFood', async (req, res) => {
  const imageBase64 = req.body.image;

  try {
    // 1. Detectar etiquetas con Vision API
    const [result] = await clientVision.labelDetection({
      image: { content: imageBase64 }
    });
    const labels = result.labelAnnotations.map(label => label.description);
    console.log("Etiquetas detectadas (en inglés):", labels);

    // 2. Traducir etiquetas al español
    const [translations] = await clientTranslate.translate(labels, 'es');
    const translatedLabels = Array.isArray(translations) ? translations : [translations];
    console.log("Etiquetas traducidas (crudo):", translatedLabels);

    // 3. Procesar etiquetas y filtrar alimentos
    const foodLabelsSet = new Set();

    translatedLabels.forEach(label => {
      const normalized = normalize(label);
      const unified = synonymMap[normalized] || normalized;

      if (foodKeywords.map(normalize).includes(unified)) {
        foodLabelsSet.add(unified);
      }
    });

    // 4. Capitalizar para mostrar al usuario
    const foodLabels = Array.from(foodLabelsSet).map(
      item => item.charAt(0).toUpperCase() + item.slice(1)
    );

    console.log("Etiquetas finales detectadas como alimento:", foodLabels);

    res.json({ foodLabels });

  } catch (error) {
    console.error("Error al detectar alimentos:", error);
    res.status(500).json({ error: "Error al procesar la imagen" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
