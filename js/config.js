// App Configuration
// Level exceptions (departments with non-standard levels) live server-side in api/_utils.js.
// Cache TTLs live in PathCacheManager (cache.js).
const CONFIG = {
  // API base URL for serverless functions
  apiBase: '/api',

  // App version - drives localStorage cache invalidation.
  // Overwritten with the build id on deploy by scripts/stamp-version.js.
  version: "1.5.0",

  // App metadata
  app: {
    name: "Caleb University Resource Bank",
    shortName: "CURB",
    description: "Access past questions and study materials for all departments"
  },

  // About page content
  about: {
    // Current session (fallback when the team API is unavailable)
    session: '2025/26',
    sessions: ['2025/26'],

    tagline: "Bridging the gaps between students and academic resources",
    mission: "To consistently collect, curate, and upload high-quality past questions in PDF format for every course and department, ensuring that all students have clear and complete access to the materials they need to excel. Our goal is a fully functional, student-accessible platform where past questions are readily available, organized, and easy to navigate, fostering a culture of academic readiness and success across all departments.",

    // Executive Team (fallback when the team API is unavailable)
    executives: [
      { name: "Jesusegun", role: "Founder & Coordinator", color: "#0F9D58" },
      { name: "Esther", role: "Content Lead", color: "#1E88E5" },
      { name: "John", role: "Technical Head", color: "#7B1FA2" },
      { name: "Jedidiah", role: "Technical Head", color: "#7B1FA2" },
      { name: "Ebun", role: "Quality Control Lead", color: "#F57C00" },
      { name: "Joy", role: "Head of New Departments", color: "#00897B" }
    ],

    // Department Representatives come from the team spreadsheet; there is no static fallback.
    departmentReps: []
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG };
}
