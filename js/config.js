// Department Configuration
const CONFIG = {
  // All departments at Caleb University
  departments: [
    "Accounting",
    "Architecture",
    "Biochemistry",
    "Business Administration",
    "Computer Science",
    "Criminology",
    "Cybersecurity",
    "Economics",
    "Human Anatomy",
    "Human Physiology",
    "Industrial Chemistry",
    "International Relations",
    "Jupeb",
    "Law",
    "Mass Communication",
    "Microbiology",
    "Nursing",
    "Political Science",
    "Psychology",
    "Software Engineering"
  ],

  // Departments with level exceptions (not all have 100-400)
  levelExceptions: {
    "Human Anatomy": [100],
    "Human Physiology": [100],
    "Software Engineering": [100],
    "Nursing": [100, 200],
    "Jupeb": ["Art", "Business", "Science"] // Note: Use normalized names consistently
  },

  // Default levels for departments not in exceptions
  defaultLevels: [100, 200, 300, 400],

  // Semester names
  semesters: ["1st Semester", "2nd Semester"],

  // Department color assignments (cycling through green spectrum)
  departmentColors: [
    "#B2DFDB", "#A5D6A7", "#81C784", "#66BB6A", 
    "#4DB6AC", "#26A69A", "#80CBC4", "#4CAF50",
    "#66BB6A", "#81C784", "#A5D6A7", "#B2DFDB",
    "#4DB6AC", "#26A69A", "#80CBC4", "#4CAF50",
    "#66BB6A", "#81C784", "#A5D6A7", "#B2DFDB"
  ],

  // App version - single source of truth for cache management
  version: "1.2.4",

  // Cache settings
  cache: {
    durationDays: 30
  },

  // API settings (will be set from environment)
  api: {
    endpoint: null // Set at runtime from env - points to backend proxy
  },

  // App metadata
  app: {
    name: "Caleb University Resource Bank",
    shortName: "CURB",
    description: "Access past questions and study materials for all departments"
  }
};

// Helper function to get levels for a department
function getDepartmentLevels(departmentName) {
  if (CONFIG.levelExceptions[departmentName]) {
    return CONFIG.levelExceptions[departmentName];
  }
  return CONFIG.defaultLevels;
}

// Helper function to get department color
function getDepartmentColor(departmentName) {
  const index = CONFIG.departments.indexOf(departmentName);
  return CONFIG.departmentColors[index] || CONFIG.departmentColors[0];
}

// Helper function to format level name
function formatLevel(level) {
  return `${level} Level`;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getDepartmentLevels, getDepartmentColor, formatLevel };
}

