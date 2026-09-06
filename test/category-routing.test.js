/**
 * @jest-environment jsdom
 */

// Mock TeamRenderer and CoverageRenderer before loading Renderer
global.TeamRenderer = class MockTeamRenderer { constructor() {} };
global.CoverageRenderer = class MockCoverageRenderer { constructor() {} };

// Load Renderer and DriveAPI modules
const { Renderer } = require('../js/renderer');
const { driveAPI } = require('../js/drive-api');

describe('Category and Multi-Format Document Logic', () => {
  let rendererInstance;

  beforeEach(() => {
    rendererInstance = new Renderer();
    document.body.innerHTML = '<div id="main-content"></div>';
  });

  describe('getFileMeta format detection', () => {
    test('identifies PDF documents', () => {
      const meta = rendererInstance.getFileMeta('CSC301_Exam.pdf', 'application/pdf');
      expect(meta.label).toBe('PDF');
      expect(meta.badgeClass).toBe('file-badge--pdf');
      expect(meta.iconHtml).toContain('fa-file-pdf');
    });

    test('identifies Word documents (.docx, .doc)', () => {
      const docxMeta = rendererInstance.getFileMeta('Lecture_Notes_Week_1.docx');
      expect(docxMeta.label).toBe('DOC');
      expect(docxMeta.badgeClass).toBe('file-badge--word');
      expect(docxMeta.iconHtml).toContain('fa-file-word');

      const docMeta = rendererInstance.getFileMeta('Syllabus.doc', 'application/msword');
      expect(docMeta.label).toBe('DOC');
    });

    test('identifies PowerPoint slides (.pptx, .ppt)', () => {
      const pptxMeta = rendererInstance.getFileMeta('Intro_To_Cybersecurity.pptx');
      expect(pptxMeta.label).toBe('PPT');
      expect(pptxMeta.badgeClass).toBe('file-badge--ppt');
      expect(pptxMeta.iconHtml).toContain('fa-file-powerpoint');

      const pptMeta = rendererInstance.getFileMeta('Chapter2.ppt');
      expect(pptMeta.label).toBe('PPT');
    });

    test('identifies ZIP / Archive bundles', () => {
      const zipMeta = rendererInstance.getFileMeta('Code_Samples.zip', 'application/zip');
      expect(zipMeta.label).toBe('ZIP');
      expect(zipMeta.badgeClass).toBe('file-badge--zip');
      expect(zipMeta.iconHtml).toContain('fa-file-zipper');
      expect(zipMeta.iconHtml).toContain('fas');

      const rarMeta = rendererInstance.getFileMeta('Project_Assets.rar');
      expect(rarMeta.label).toBe('ZIP');
    });

    test('identifies Excel spreadsheets and Text files', () => {
      const xlsMeta = rendererInstance.getFileMeta('Grades_Template.xlsx');
      expect(xlsMeta.label).toBe('XLS');
      expect(xlsMeta.iconHtml).toContain('fa-file-excel');

      const txtMeta = rendererInstance.getFileMeta('README.txt');
      expect(txtMeta.label).toBe('TXT');
      expect(txtMeta.iconHtml).toContain('fa-file-lines');
    });

    test('handles unknown extensions and missing names gracefully', () => {
      const unknown = rendererInstance.getFileMeta('data.xyz');
      expect(unknown.label).toBe('XYZ');
      expect(unknown.badgeClass).toBe('file-badge--default');

      const empty = rendererInstance.getFileMeta('');
      expect(empty.label).toBe('FILE');
    });
  });

  describe('getCategoryMeta category classification', () => {
    test('classifies singular and plural Past Question variations', () => {
      const singular = rendererInstance.getCategoryMeta('Past Question');
      expect(singular.title).toBe('Past Questions');
      expect(singular.cardModifier).toBe('category-card--pq');
      expect(singular.iconHtml).toContain('fa-file-signature');

      const plural = rendererInstance.getCategoryMeta('Past Questions');
      expect(plural.title).toBe('Past Questions');

      const abbreviation = rendererInstance.getCategoryMeta('PQ');
      expect(abbreviation.title).toBe('Past Questions');
    });

    test('classifies singular and plural Course Material variations', () => {
      const singular = rendererInstance.getCategoryMeta('Course Material');
      expect(singular.title).toBe('Course Materials');
      expect(singular.cardModifier).toBe('category-card--materials');
      expect(singular.iconHtml).toContain('fa-book-open');

      const plural = rendererInstance.getCategoryMeta('Course Materials');
      expect(plural.title).toBe('Course Materials');

      const lectureNotes = rendererInstance.getCategoryMeta('Lecture Notes');
      expect(lectureNotes.title).toBe('Course Materials');
    });

    test('provides generic fallback for custom category folder names', () => {
      const custom = rendererInstance.getCategoryMeta('Textbooks');
      expect(custom.title).toBe('Textbooks');
      expect(custom.cardModifier).toBe('category-card--general');
      expect(custom.iconHtml).toContain('fa-folder-open');
    });
  });

  describe('Adaptive Session Content (Dual-State Behavior)', () => {
    let container;

    beforeEach(() => {
      container = document.getElementById('main-content');
    });

    test('renders category cards when subfolders exist (Migrated Session)', async () => {
      jest.spyOn(driveAPI, 'fetchFolders').mockResolvedValue([
        { id: '1', name: 'Course Material' },
        { id: '2', name: 'Past Question' }
      ]);

      const route = {
        department: 'Cybersecurity',
        level: '300 Level',
        semester: '1st Semester',
        session: '2024~25 Session'
      };

      await rendererInstance.renderSessionContent(container, route);

      const cards = container.querySelectorAll('.category-card');
      expect(cards.length).toBe(2);

      // Past Questions should be sorted first
      expect(cards[0].querySelector('.category-card__title').textContent).toBe('Past Questions');
      expect(cards[1].querySelector('.category-card__title').textContent).toBe('Course Materials');

      expect(cards[0].getAttribute('href')).toContain('/Past%20Question');
      expect(cards[1].getAttribute('href')).toContain('/Course%20Material');
    });

    test('falls back directly to file list when no subfolders exist (Unmigrated Session)', async () => {
      // Subfolders check returns empty array
      jest.spyOn(driveAPI, 'fetchFolders').mockResolvedValue([]);
      // Files fetch returns past questions directly
      jest.spyOn(driveAPI, 'fetchFiles').mockResolvedValue([
        {
          id: 'file-1',
          name: 'CYB201_2023.pdf',
          size: 1048576,
          modifiedTime: '2024-01-15T10:00:00Z'
        }
      ]);

      const route = {
        department: 'Cybersecurity',
        level: '200 Level',
        semester: '1st Semester',
        session: '2024~25 Session'
      };

      await rendererInstance.renderSessionContent(container, route);

      // Category cards should NOT be shown
      expect(container.querySelectorAll('.category-card').length).toBe(0);

      // File list should be shown directly
      const fileCards = container.querySelectorAll('.file-card');
      expect(fileCards.length).toBe(1);
      expect(fileCards[0].querySelector('.file-name').textContent).toBe('CYB201_2023.pdf');
    });

    test('renders multi-format documents inside a category route', async () => {
      jest.spyOn(driveAPI, 'fetchFiles').mockResolvedValue([
        { id: 'f1', name: 'Slides_Week1.pptx', size: 2097152 },
        { id: 'f2', name: 'Assignment.docx', size: 512000 },
        { id: 'f3', name: 'SourceCode.zip', size: 4194304 },
        { id: 'f4', name: 'Syllabus.pdf', size: 102400 }
      ]);

      const route = {
        department: 'Cybersecurity',
        level: '300 Level',
        semester: '1st Semester',
        session: '2024~25 Session',
        category: 'Course Material'
      };

      await rendererInstance.renderFiles(container, route);

      const fileCards = container.querySelectorAll('.file-card');
      expect(fileCards.length).toBe(4);

      const badges = Array.from(container.querySelectorAll('.file-badge')).map(b => b.textContent.trim());
      expect(badges).toEqual(['PPT', 'DOC', 'ZIP', 'PDF']);
    });
  });
});
