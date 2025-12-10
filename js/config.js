// Department Configuration
const CONFIG = {
  // NOTE: Departments are now fetched dynamically from Google Drive
  // This array is kept for reference but no longer used for rendering
  // To add/remove departments, simply create/delete folders in Google Drive root
  
  // Departments with level exceptions (not all have 100-400)
  // These define BEHAVIOR, not just data - must remain in config
  levelExceptions: {
    "Human Anatomy": [100],
    "Human Physiology": [100],
    "Software Engineering": [100],
    "Nursing": [100, 200],
    "Jupeb": ["Art", "Business", "Science"] // Jupeb has subjects, not levels
  },

  // Default levels for departments not in exceptions
  defaultLevels: [100, 200, 300, 400],

  // Semester names
  semesters: ["1st Semester", "2nd Semester"],

  // NOTE: Department colors are now auto-generated or looked up from getDepartmentColor()
  // The departmentColors array has been removed in favor of dynamic color assignment

  // App version - single source of truth for cache management
  // 1.4.0 - Dynamic departments from Google Drive (no-code maintenance)
  version: "1.4.0",

  // Cache settings for lazy loading
  cache: {
    // Path cache TTL (6 hours) - after this, data is considered stale
    // Stale data is still shown immediately while fresh data is fetched in background
    ttlHours: 6,
    
    // Hard expiry (24 hours) - after this, cached data is not used at all
    hardExpiryHours: 24,
    
    // Legacy setting kept for compatibility
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
  },

  // About page content
  about: {
    tagline: "Bridging the gaps between students and academic resources",
    mission: "To consistently collect, curate, and upload high-quality past questions in PDF format for every course and department, ensuring that all students have clear and complete access to the materials they need to excel.",
    vision: "A fully functional, student-accessible Google Drive and website platform by October 31st, where past questions are readily available, organized, and easy to navigate—fostering a culture of academic readiness and success across all departments.",
    
    // Founder
    founder: {
      name: "Jesusegun",
      role: "Founder & Coordinator",
      color: "#0F9D58" // Primary green
    },
    
    // Executive Team
    executives: [
      { name: "Esther", role: "Content Lead", department: "Head of Department Reps", color: "#1E88E5" },
      { name: "John", role: "Technical Head", department: "Development", color: "#7B1FA2" },
      { name: "Jedidiah", role: "Technical Head", department: "Development", color: "#7B1FA2" },
      { name: "Ebun", role: "Quality Control Lead", department: "Quality Assurance", color: "#F57C00" },
      { name: "Joy", role: "Head of New Departments", department: "Expansion", color: "#00897B" }
    ],
    
    // Department Representatives (placeholders - update names when available)
    departmentReps: [
      { name: "Praise", department: "Computer Science" },
      { name: "TBD", department: "Accounting" },
      { name: "TBD", department: "Architecture" },
      { name: "TBD", department: "Biochemistry" },
      { name: "TBD", department: "Business Administration" },
      { name: "TBD", department: "Criminology" },
      { name: "TBD", department: "Cybersecurity" },
      { name: "TBD", department: "Economics" },
      { name: "TBD", department: "Human Anatomy" },
      { name: "TBD", department: "Human Physiology" },
      { name: "TBD", department: "Industrial Chemistry" },
      { name: "TBD", department: "International Relations" },
      { name: "TBD", department: "Jupeb" },
      { name: "TBD", department: "Law" },
      { name: "TBD", department: "Mass Communication" },
      { name: "TBD", department: "Microbiology" },
      { name: "TBD", department: "Nursing" },
      { name: "TBD", department: "Political Science" },
      { name: "TBD", department: "Psychology" },
      { name: "TBD", department: "Software Engineering" }
    ]
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
// Uses predefined colors for known departments, generates for new ones
function getDepartmentColor(departmentName) {
  // Predefined colors for existing departments
  const departmentColorMap = {
    'Accounting': '#B2DFDB',
    'Architecture': '#A5D6A7',
    'Biochemistry': '#81C784',
    'Business Administration': '#66BB6A',
    'Computer Science': '#4DB6AC',
    'Criminology': '#26A69A',
    'Cybersecurity': '#80CBC4',
    'Economics': '#4CAF50',
    'Human Anatomy': '#66BB6A',
    'Human Physiology': '#81C784',
    'Industrial Chemistry': '#A5D6A7',
    'International Relations': '#B2DFDB',
    'Jupeb': '#4DB6AC',
    'Law': '#26A69A',
    'Mass Communication': '#80CBC4',
    'Microbiology': '#4CAF50',
    'Nursing': '#66BB6A',
    'Political Science': '#81C784',
    'Psychology': '#A5D6A7',
    'Software Engineering': '#B2DFDB'
  };
  
  // Return predefined color if exists
  if (departmentColorMap[departmentName]) {
    return departmentColorMap[departmentName];
  }
  
  // Generate consistent color for unknown departments
  // Uses a hash of the department name to always get same color
  let hash = 0;
  for (let i = 0; i < departmentName.length; i++) {
    hash = departmentName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate a pleasant green-teal color (matching the app theme)
  const hue = 120 + (Math.abs(hash) % 60); // 120-180 (green to cyan)
  const saturation = 40 + (Math.abs(hash >> 8) % 30); // 40-70%
  const lightness = 65 + (Math.abs(hash >> 16) % 20); // 65-85%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Helper function to format level name
function formatLevel(level) {
  return `${level} Level`;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getDepartmentLevels, getDepartmentColor, formatLevel };
}

