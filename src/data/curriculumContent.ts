// Curriculum content types and utilities for lesson plan generation

export interface CurriculumTopic {
  title: string;
  objectives: string[];
  subtopics?: string[];
}

export interface CurriculumContent {
  country: string;
  level: string;
  subject: string;
  description: string;
  topics: CurriculumTopic[];
}

// Class levels for different countries (Primary 1-6 only)
const CLASS_LEVELS = {
  nigeria: [
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'
  ],
  cameroon: [
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'
  ]
};

// Fallback curriculum content (in-memory)
const FALLBACK_CURRICULUM: Record<string, CurriculumContent> = {
  nigeria: {
    country: 'Nigeria',
    level: 'Primary',
    subject: 'Mathematics',
    description: 'Nigerian National Mathematics Curriculum for Primary Schools',
    topics: [
      {
        title: 'Number and Numeration',
        objectives: [
          'Understand place value and notation',
          'Perform basic arithmetic operations',
          'Work with fractions and decimals'
        ],
        subtopics: ['Whole numbers', 'Fractions', 'Decimals', 'Percentages']
      },
      {
        title: 'Basic Operations',
        objectives: [
          'Master addition and subtraction',
          'Perform multiplication and division',
          'Apply operations to solve problems'
        ],
        subtopics: ['Addition', 'Subtraction', 'Multiplication', 'Division']
      },
      {
        title: 'Measurement',
        objectives: [
          'Measure length, mass, and capacity',
          'Understanding time and money',
          'Apply measurement in real contexts'
        ],
        subtopics: ['Length', 'Mass', 'Capacity', 'Time', 'Money']
      },
      {
        title: 'Geometry',
        objectives: [
          'Identify 2D and 3D shapes',
          'Understand properties of shapes',
          'Apply geometric concepts'
        ],
        subtopics: ['2D shapes', '3D shapes', 'Angles', 'Symmetry']
      }
    ]
  },
  cameroon: {
    country: 'Cameroon',
    level: 'Primary',
    subject: 'Mathematics',
    description: 'Cameroonian National Mathematics Curriculum for Primary Schools',
    topics: [
      {
        title: 'Numération',
        objectives: [
          'Comprendre la valeur de position',
          'Effectuer des opérations de base',
          'Travailler avec les fractions'
        ],
        subtopics: ['Nombres entiers', 'Fractions', 'Décimaux']
      },
      {
        title: 'Opérations de base',
        objectives: [
          'Maîtriser l\'addition et la soustraction',
          'Effectuer la multiplication et la division',
          'Résoudre des problèmes'
        ],
        subtopics: ['Addition', 'Soustraction', 'Multiplication', 'Division']
      },
      {
        title: 'Mesure',
        objectives: [
          'Mesurer la longueur, la masse et la capacité',
          'Comprendre le temps et l\'argent',
          'Appliquer les mesures'
        ],
        subtopics: ['Longueur', 'Masse', 'Capacité', 'Temps', 'Argent']
      },
      {
        title: 'Géométrie',
        objectives: [
          'Identifier les formes 2D et 3D',
          'Comprendre les propriétés',
          'Appliquer les concepts géométriques'
        ],
        subtopics: ['Formes 2D', 'Formes 3D', 'Angles', 'Symétrie']
      }
    ]
  }
};

/**
 * Get curriculum content synchronously (fallback)
 */
export function getCurriculumContent(country: string): CurriculumContent {
  const normalizedCountry = country.toLowerCase();
  return FALLBACK_CURRICULUM[normalizedCountry] || FALLBACK_CURRICULUM.nigeria;
}

/**
 * Load curriculum content from JSON file asynchronously
 */
export async function getCurriculumContentAsync(country: string): Promise<CurriculumContent> {
  try {
    const normalizedCountry = country.toLowerCase();
    const response = await fetch(`/content/curriculum-level-one-math.json`);
    
    if (!response.ok) {
      console.warn('Failed to load curriculum JSON, using fallback');
      return getCurriculumContent(normalizedCountry);
    }
    
    const data = await response.json();
    
    // If JSON has country-specific data, return it
    if (data[normalizedCountry]) {
      return data[normalizedCountry];
    }
    
    // If JSON is the curriculum data itself
    if (data.country && data.topics) {
      return data;
    }
    
    // Fallback to in-memory data
    return getCurriculumContent(normalizedCountry);
  } catch (error) {
    console.error('Error loading curriculum:', error);
    return getCurriculumContent(country);
  }
}

/**
 * Get default class level for a country
 */
export function getDefaultClassLevel(country: string): string {
  const normalizedCountry = country.toLowerCase();
  const levels = CLASS_LEVELS[normalizedCountry as keyof typeof CLASS_LEVELS];
  return levels ? levels[0] : 'Primary 1';
}

/**
 * Get all class levels for a country
 */
export function getClassLevelsForCountry(country: string): string[] {
  const normalizedCountry = country.toLowerCase();
  return CLASS_LEVELS[normalizedCountry as keyof typeof CLASS_LEVELS] || CLASS_LEVELS.nigeria;
}

/**
 * Format curriculum content for AI prompt
 */
export function formatCurriculumForPrompt(curriculum: CurriculumContent): string {
  if (!curriculum || !curriculum.topics) {
    return '';
  }

  let formatted = `Curriculum Context: ${curriculum.description}\n\n`;
  formatted += `Subject: ${curriculum.subject}\n`;
  formatted += `Level: ${curriculum.level}\n\n`;
  formatted += `Key Topics:\n`;

  curriculum.topics.forEach((topic, index) => {
    formatted += `\n${index + 1}. ${topic.title}\n`;
    
    if (topic.objectives && topic.objectives.length > 0) {
      formatted += `   Learning Objectives:\n`;
      topic.objectives.forEach(obj => {
        formatted += `   - ${obj}\n`;
      });
    }
    
    if (topic.subtopics && topic.subtopics.length > 0) {
      formatted += `   Subtopics: ${topic.subtopics.join(', ')}\n`;
    }
  });

  return formatted;
}
