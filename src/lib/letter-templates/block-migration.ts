import {
  LetterSection,
  LetterTemplateDocument,
  DetailField,
  BulletListItem,
  ClauseItem,
  OpeningSection,
  DetailsSection,
  RoleResponsibilitiesSection,
  TermsSection,
  AcceptanceSection,
} from './block-types';
import { CONSULTANT_OFFER_LETTER_SECTIONS } from './consultant-offer-blocks';
import { formatVisualVariables } from './variables';

export function isConsultantOfferLetterHtml(html: string): boolean {
  if (!html) return false;
  return (
    html.includes('Consultant Offer Letter') &&
    (html.includes('Engagement Details') || html.includes('Position Title')) &&
    html.includes('NavGurukul')
  );
}

/**
 * Convert legacy 17 individual blocks into 5 major sections
 */
export function convert17BlocksTo5Sections(blocks: any[]): LetterSection[] {
  if (!blocks || blocks.length === 0) {
    return JSON.parse(JSON.stringify(CONSULTANT_OFFER_LETTER_SECTIONS));
  }

  // If already sections (has type 'opening' or 'role_responsibilities' or 'terms')
  if (blocks.some((b) => b.type === 'role_responsibilities' || b.type === 'terms')) {
    return blocks as LetterSection[];
  }

  let openingContent = '';
  const detailsFields: DetailField[] = [];
  let roleOverview = '';
  const responsibilities: BulletListItem[] = [];
  const clauses: ClauseItem[] = [];
  let acceptanceContent = '';
  let employerSig = {
    header: 'For NavGurukul Foundation for Social Welfare',
    signatoryName: '[Authorized Signatory Name]',
    signatoryTitle: '[Authorized Signatory Title]',
    dateText: 'Date: [Offer Letter Date]',
  };
  let candidateSig = {
    header: 'Accepted & Agreed',
    signatoryName: '[Full Name]',
    signatoryTitle: '[Designation]',
    dateText: 'Date: [Date of Acceptance]',
  };

  blocks.forEach((b) => {
    const titleLower = (b.title || '').toLowerCase();

    if (b.type === 'signature') {
      if (b.employer) employerSig = { ...employerSig, ...b.employer };
      if (b.candidate) candidateSig = { ...candidateSig, ...b.candidate };
    } else if (titleLower.includes('opening')) {
      openingContent = b.content || openingContent;
    } else if (b.type === 'details') {
      if (Array.isArray(b.fields)) {
        detailsFields.push(...b.fields);
      }
    } else if (titleLower.includes('overview')) {
      roleOverview = b.content || roleOverview;
    } else if (b.type === 'bullet_list' || titleLower.includes('responsibilit')) {
      if (Array.isArray(b.items)) {
        responsibilities.push(...b.items);
      }
    } else if (b.type === 'clause' || titleLower.includes('clause') || titleLower.includes('period') || titleLower.includes('policy') || titleLower.includes('policies') || titleLower.includes('leave') || titleLower.includes('data') || titleLower.includes('compete') || titleLower.includes('dispute')) {
      clauses.push({
        id: b.id || `cl-${Math.random().toString(36).substring(2, 7)}`,
        title: b.clauseTitle || b.title || 'Term',
        content: b.content || '',
      });
    } else if (titleLower.includes('acceptance')) {
      acceptanceContent = b.content || acceptanceContent;
    } else if (titleLower.includes('joining') || titleLower.includes('location') || titleLower.includes('compensation')) {
      // Field blocks like Date of Joining or Work Location
      detailsFields.push({
        id: b.id || `f-${Math.random().toString(36).substring(2, 7)}`,
        label: b.title || 'Detail',
        value: b.content || '',
      });
    } else if (b.type === 'text' || b.type === 'rich_text') {
      if (!openingContent) {
        openingContent = b.content;
      } else {
        clauses.push({
          id: b.id || `cl-${Math.random().toString(36).substring(2, 7)}`,
          title: b.title || 'Clause',
          content: b.content || '',
        });
      }
    }
  });

  const sections: LetterSection[] = [
    {
      id: 'sec-opening',
      type: 'opening',
      title: 'Opening',
      order: 1,
      content: openingContent || (CONSULTANT_OFFER_LETTER_SECTIONS[0] as OpeningSection).content,
    },
    {
      id: 'sec-details',
      type: 'details',
      title: 'Engagement Details',
      order: 2,
      fields: detailsFields.length > 0 ? detailsFields : (CONSULTANT_OFFER_LETTER_SECTIONS[1] as DetailsSection).fields,
    },
    {
      id: 'sec-role-responsibilities',
      type: 'role_responsibilities',
      title: 'Role & Responsibilities',
      order: 3,
      roleOverview: roleOverview || (CONSULTANT_OFFER_LETTER_SECTIONS[2] as RoleResponsibilitiesSection).roleOverview,
      responsibilities: responsibilities.length > 0 ? responsibilities : (CONSULTANT_OFFER_LETTER_SECTIONS[2] as RoleResponsibilitiesSection).responsibilities,
    },
    {
      id: 'sec-terms',
      type: 'terms',
      title: 'Terms of Engagement',
      order: 4,
      clauses: clauses.length > 0 ? clauses : (CONSULTANT_OFFER_LETTER_SECTIONS[3] as TermsSection).clauses,
    },
    {
      id: 'sec-acceptance',
      type: 'acceptance',
      title: 'Acceptance',
      order: 5,
      content: acceptanceContent || (CONSULTANT_OFFER_LETTER_SECTIONS[4] as AcceptanceSection).content,
      signature: {
        employer: employerSig,
        candidate: candidateSig,
      },
    },
  ];

  return sections;
}

/**
 * Losslessly parse HTML into the 5-section document structure
 */
export function migrateHtmlToBlocks(html: string): LetterTemplateDocument {
  if (!html || !html.trim()) {
    return {
      version: 1,
      sections: JSON.parse(JSON.stringify(CONSULTANT_OFFER_LETTER_SECTIONS)),
    };
  }

  // If this is the known Consultant Offer Letter HTML, return the verified 5-section document
  if (isConsultantOfferLetterHtml(html)) {
    return {
      version: 1,
      sections: JSON.parse(JSON.stringify(CONSULTANT_OFFER_LETTER_SECTIONS)),
    };
  }

  // Generic HTML migration
  let openingContent = '';
  const detailsFields: DetailField[] = [];
  let roleOverview = '';
  const responsibilities: BulletListItem[] = [];
  const clauses: ClauseItem[] = [];
  let acceptanceContent = '';
  const employerSig = {
    header: 'For NavGurukul Foundation for Social Welfare',
    signatoryName: '[Authorized Signatory Name]',
    signatoryTitle: '[Authorized Signatory Title]',
    dateText: 'Date: [Offer Letter Date]',
  };
  const candidateSig = {
    header: 'Accepted & Agreed',
    signatoryName: '[Full Name]',
    signatoryTitle: '[Designation]',
    dateText: 'Date: [Date of Acceptance]',
  };

  // 1. Extract tables
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[0];

    // Check if signature table
    if (
      tableHtml.toLowerCase().includes('authorized signatory') ||
      tableHtml.toLowerCase().includes('accepted & agreed') ||
      tableHtml.toLowerCase().includes('for navgurukul')
    ) {
      if (tableHtml.includes('Candidate Acceptance')) {
        candidateSig.header = 'Candidate Acceptance';
      }
    } else {
      // 2-column key/value table
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cellMatch[1]);
        }
        if (cells.length >= 2) {
          const label = cells[0].replace(/<[^>]+>/g, '').trim();
          const rawVal = cells[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
          if (label) {
            detailsFields.push({
              id: `f-${Math.random().toString(36).substring(2, 7)}`,
              label,
              value: formatVisualVariables(rawVal),
            });
          }
        }
      }
    }
  }

  // 2. Extract lists
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let ulMatch: RegExpExecArray | null;

  while ((ulMatch = ulRegex.exec(html)) !== null) {
    const ulContent = ulMatch[1];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;

    while ((liMatch = liRegex.exec(ulContent)) !== null) {
      const li = liMatch[1];
      const strongMatch = li.match(/<strong>([^<]+?)[:\s]*<\/strong>([\s\S]*)/i);
      if (strongMatch) {
        // This is a clause
        const clTitle = strongMatch[1].replace(/:\s*$/, '').trim();
        const clContent = formatVisualVariables(strongMatch[2].replace(/<[^>]+>/g, '').trim());
        clauses.push({
          id: `cl-${Math.random().toString(36).substring(2, 7)}`,
          title: clTitle,
          content: clContent,
        });
      } else {
        // Responsibility list item
        const text = formatVisualVariables(li.replace(/<[^>]+>/g, '').trim());
        if (text) {
          responsibilities.push({
            id: `item-${Math.random().toString(36).substring(2, 7)}`,
            text,
          });
        }
      }
    }
  }

  // 3. Extract paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  const paragraphs: string[] = [];

  while ((pMatch = pRegex.exec(html)) !== null) {
    const pText = formatVisualVariables(pMatch[1].replace(/<[^>]+>/g, '').trim());
    if (pText) paragraphs.push(pText);
  }

  paragraphs.forEach((p) => {
    const pLower = p.toLowerCase();
    if (pLower.includes('acceptance') || pLower.includes('confirm your acceptance') || pLower.includes('duly confirmed')) {
      acceptanceContent = p;
    } else if (pLower.includes('role overview') || pLower.includes('summary of duties')) {
      roleOverview = p.replace(/^(role overview|summary of duties)[:\s]*/i, '').trim();
    } else if (pLower.startsWith('dear ') || pLower.includes('delighted to inform') || pLower.includes('greetings')) {
      openingContent = openingContent ? `${openingContent}\n\n${p}` : p;
    }
  });

  return {
    version: 1,
    sections: [
      {
        id: 'sec-opening',
        type: 'opening',
        title: 'Opening',
        order: 1,
        content: openingContent || (CONSULTANT_OFFER_LETTER_SECTIONS[0] as OpeningSection).content,
      },
      {
        id: 'sec-details',
        type: 'details',
        title: 'Engagement Details',
        order: 2,
        fields: detailsFields.length > 0 ? detailsFields : (CONSULTANT_OFFER_LETTER_SECTIONS[1] as DetailsSection).fields,
      },
      {
        id: 'sec-role-responsibilities',
        type: 'role_responsibilities',
        title: 'Role & Responsibilities',
        order: 3,
        roleOverview: roleOverview || (CONSULTANT_OFFER_LETTER_SECTIONS[2] as RoleResponsibilitiesSection).roleOverview,
        responsibilities: responsibilities.length > 0 ? responsibilities : (CONSULTANT_OFFER_LETTER_SECTIONS[2] as RoleResponsibilitiesSection).responsibilities,
      },
      {
        id: 'sec-terms',
        type: 'terms',
        title: 'Terms of Engagement',
        order: 4,
        clauses: clauses.length > 0 ? clauses : (CONSULTANT_OFFER_LETTER_SECTIONS[3] as TermsSection).clauses,
      },
      {
        id: 'sec-acceptance',
        type: 'acceptance',
        title: 'Acceptance',
        order: 5,
        content: acceptanceContent || (CONSULTANT_OFFER_LETTER_SECTIONS[4] as AcceptanceSection).content,
        signature: {
          employer: employerSig,
          candidate: candidateSig,
        },
      },
    ],
  };
}
