'use client';

import { normalize, normalizeCompany } from './parsers';
import { getCompanyLogoUrl } from './images';
import type { GraphNode, GraphLink, GraphData } from './graph/types';

// --- localStorage schema types ---

interface StoredCompanyEdge {
  companyName: string;
  companyNameNormalized: string;
  logoUrl: string | null;
  position: string;
  startYear: number | null;
  endYear: number | null;
  projects: string[];
  coworkers: string[];
  reportsTo: string | null;
  performanceComments: string | null;
}

interface StoredPerson {
  name: string;
  nameNormalized: string;
  summary: string;
  photoUrl: string | null;
  expanded: boolean;
  companies: StoredCompanyEdge[];
}

interface StoredPersonEdge {
  personName: string;
  personNameNormalized: string;
  photoUrl: string | null;
  position: string;
  startYear: number | null;
  endYear: number | null;
  projects: string[];
  coworkers: string[];
  reportsTo: string | null;
}

interface StoredCompany {
  name: string;
  nameNormalized: string;
  description: string;
  products: string;
  history: string;
  logoUrl: string | null;
  expanded: boolean;
  notablePeople: StoredPersonEdge[];
}

interface StoredSettings {
  activeProvider: string;
}

// --- localStorage keys ---

const PERSONS_KEY = 'careers_persons';
const COMPANIES_KEY = 'careers_companies';
const SETTINGS_KEY = 'careers_settings';

// --- helpers ---

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Find an existing key that matches a normalized name.
 * Checks exact match first, then substring containment (longer name contains shorter).
 */
function findMatchingKey(keys: string[], norm: string): string | null {
  if (keys.includes(norm)) return norm;
  for (const k of keys) {
    if (k.includes(norm) || norm.includes(k)) return k;
  }
  return null;
}

function getPersons(): Record<string, StoredPerson> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(PERSONS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setPersons(data: Record<string, StoredPerson>): void {
  if (!isBrowser()) return;
  localStorage.setItem(PERSONS_KEY, JSON.stringify(data));
}

function getCompanies(): Record<string, StoredCompany> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(COMPANIES_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCompanies(data: Record<string, StoredCompany>): void {
  if (!isBrowser()) return;
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(data));
}

function getSettings(): StoredSettings {
  if (!isBrowser()) return { activeProvider: 'anthropic' };
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as StoredSettings;
  } catch {
    return { activeProvider: 'anthropic' };
  }
}

function setSettings(data: StoredSettings): void {
  if (!isBrowser()) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

// --- public API ---

export interface PersonApiData {
  name: string;
  nameNormalized: string;
  summary: string;
  photoUrl: string | null;
  companies: Array<{
    companyName: string;
    companyNameNormalized: string;
    logoUrl: string | null;
    position: string;
    startYear: number | null;
    endYear: number | null;
    projects: string[];
    coworkers: string[];
    reportsTo: string | null;
    performanceComments: string | null;
  }>;
}

export interface CompanyApiData {
  name: string;
  nameNormalized: string;
  description: string;
  products: string;
  history: string;
  logoUrl: string | null;
  notablePeople: Array<{
    personName: string;
    personNameNormalized: string;
    photoUrl: string | null;
    position: string;
    startYear: number | null;
    endYear: number | null;
    projects: string[];
    coworkers: string[];
    reportsTo: string | null;
  }>;
}

/**
 * Upsert a person and create company stubs for each company in their career.
 */
export function mergePersonData(data: PersonApiData): void {
  if (!isBrowser()) return;

  const persons = getPersons();
  const companies = getCompanies();

  // Resolve person key — match existing entry if possible
  const personNorm = findMatchingKey(Object.keys(persons), data.nameNormalized) || data.nameNormalized;
  const existing = persons[personNorm];

  // Resolve company names and build incoming companies list
  const resolvedCompanies = data.companies.map(c => {
    const resolvedNorm = findMatchingKey(Object.keys(companies), c.companyNameNormalized) || c.companyNameNormalized;
    return {
      companyName: c.companyName,
      companyNameNormalized: resolvedNorm,
      logoUrl: c.logoUrl,
      position: c.position,
      startYear: c.startYear,
      endYear: c.endYear,
      projects: c.projects,
      coworkers: c.coworkers,
      reportsTo: c.reportsTo,
      performanceComments: c.performanceComments,
    };
  });

  // Merge new companies into existing list (avoid duplicates)
  const existingCompanies = existing?.companies || [];
  const existingCompanyNorms = new Set(existingCompanies.map(c => c.companyNameNormalized));
  const mergedCompanies = [
    ...existingCompanies,
    ...resolvedCompanies.filter(c => !existingCompanyNorms.has(c.companyNameNormalized)),
  ];

  persons[personNorm] = {
    name: data.name,
    nameNormalized: personNorm,
    summary: data.summary || existing?.summary || '',
    photoUrl: data.photoUrl || existing?.photoUrl || null,
    expanded: true,
    companies: mergedCompanies,
  };

  // Create company stubs if they don't exist
  const companyKeys = Object.keys(companies);
  for (const c of persons[personNorm].companies) {
    const compNorm = c.companyNameNormalized;
    if (!companies[compNorm]) {
      companies[compNorm] = {
        name: c.companyName,
        nameNormalized: compNorm,
        description: '',
        products: '',
        history: '',
        logoUrl: c.logoUrl,
        expanded: false,
        notablePeople: [],
      };
      companyKeys.push(compNorm);
    } else {
      if (c.logoUrl && !companies[compNorm].logoUrl) {
        companies[compNorm].logoUrl = c.logoUrl;
      }
    }
  }

  setPersons(persons);
  setCompanies(companies);
}

/**
 * Upsert a company and create person stubs for each notable person.
 */
export function mergeCompanyData(data: CompanyApiData): void {
  if (!isBrowser()) return;

  const persons = getPersons();
  const companies = getCompanies();

  // Resolve company key — match existing entry if possible
  const compNorm = findMatchingKey(Object.keys(companies), data.nameNormalized) || data.nameNormalized;
  const existing = companies[compNorm];

  // Resolve person names against existing persons
  const personKeys = Object.keys(persons);
  const resolvedPeople = data.notablePeople.map(p => {
    const resolvedNorm = findMatchingKey(personKeys, p.personNameNormalized) || p.personNameNormalized;
    return { ...p, personNameNormalized: resolvedNorm };
  });

  // Merge new people into existing list (avoid duplicates)
  const existingPeople = existing?.notablePeople || [];
  const existingPeopleNorms = new Set(existingPeople.map(p => p.personNameNormalized));
  const mergedPeople = [
    ...existingPeople,
    ...resolvedPeople
      .filter(p => !existingPeopleNorms.has(p.personNameNormalized))
      .map(p => ({
        personName: p.personName,
        personNameNormalized: p.personNameNormalized,
        photoUrl: p.photoUrl,
        position: p.position,
        startYear: p.startYear,
        endYear: p.endYear,
        projects: p.projects,
        coworkers: p.coworkers,
        reportsTo: p.reportsTo,
      })),
  ];

  companies[compNorm] = {
    name: data.name,
    nameNormalized: compNorm,
    description: data.description || existing?.description || '',
    products: data.products || existing?.products || '',
    history: data.history || existing?.history || '',
    logoUrl: data.logoUrl || existing?.logoUrl || null,
    expanded: true,
    notablePeople: mergedPeople,
  };

  // Create person stubs if they don't exist
  for (const p of resolvedPeople) {
    const pNorm = p.personNameNormalized;
    if (!persons[pNorm]) {
      persons[pNorm] = {
        name: p.personName,
        nameNormalized: pNorm,
        summary: '',
        photoUrl: p.photoUrl,
        expanded: false,
        companies: [],
      };
      personKeys.push(pNorm);
    } else {
      if (p.photoUrl && !persons[pNorm].photoUrl) {
        persons[pNorm].photoUrl = p.photoUrl;
      }
    }
  }

  setPersons(persons);
  setCompanies(companies);
}

/**
 * Build the graph from localStorage. Merges edges from both person and company
 * sides and deduplicates by (personNorm, companyNorm, position).
 * Re-normalizes all names to catch stale keys from older normalization logic.
 */
export function buildGraph(): GraphData {
  if (!isBrowser()) return { nodes: [], links: [] };

  const persons = getPersons();
  const companies = getCompanies();

  // Build canonical ID maps — re-normalize to dedup stale keys.
  // e.g. "blue titan software" and "blue titan" both map to "company:blue titan"
  const personCanonical = new Map<string, string>(); // old norm → canonical node ID
  const companyCanonical = new Map<string, string>(); // old norm → canonical node ID

  const personNodeMap = new Map<string, GraphNode>();   // canonical ID → node
  const companyNodeMap = new Map<string, GraphNode>();   // canonical ID → node

  for (const p of Object.values(persons)) {
    const freshNorm = normalize(p.name);
    const canonId = `person:${freshNorm}`;
    personCanonical.set(p.nameNormalized, canonId);
    // Keep the most-expanded version
    const prev = personNodeMap.get(canonId);
    if (!prev || (!prev.expanded && p.expanded)) {
      personNodeMap.set(canonId, {
        id: canonId,
        type: 'person',
        name: p.name,
        expanded: p.expanded,
        summary: p.summary || prev?.summary || undefined,
        imageUrl: p.photoUrl || prev?.imageUrl || undefined,
      });
    }
  }

  for (const c of Object.values(companies)) {
    const freshNorm = normalizeCompany(c.name);
    const canonId = `company:${freshNorm}`;
    companyCanonical.set(c.nameNormalized, canonId);
    const prev = companyNodeMap.get(canonId);
    if (!prev || (!prev.expanded && c.expanded)) {
      companyNodeMap.set(canonId, {
        id: canonId,
        type: 'company',
        name: c.name,
        expanded: c.expanded,
        description: c.description || prev?.description || undefined,
        products: c.products || prev?.products || undefined,
        history: c.history || prev?.history || undefined,
        imageUrl: c.logoUrl || prev?.imageUrl || undefined,
      });
    }
  }

  // Helper to resolve any person/company norm to its canonical node ID
  function resolvePersonId(norm: string): string {
    return personCanonical.get(norm) || `person:${normalize(norm)}`;
  }
  function resolveCompanyId(norm: string): string {
    return companyCanonical.get(norm) || `company:${normalizeCompany(norm)}`;
  }

  const linkMap = new Map<string, GraphLink>();

  // Edges from person side
  for (const p of Object.values(persons)) {
    const personId = resolvePersonId(p.nameNormalized);
    for (const c of p.companies) {
      const companyId = resolveCompanyId(c.companyNameNormalized);
      const edgeKey = `${personId}||${companyId}||${c.position}`;
      if (!linkMap.has(edgeKey)) {
        linkMap.set(edgeKey, {
          source: personId,
          target: companyId,
          position: c.position,
          startYear: c.startYear,
          endYear: c.endYear,
          projects: c.projects,
          coworkers: c.coworkers,
          reportsTo: c.reportsTo,
          performanceComments: c.performanceComments,
        });
      }
    }
  }

  // Edges from company side
  for (const c of Object.values(companies)) {
    const companyId = resolveCompanyId(c.nameNormalized);
    for (const p of c.notablePeople) {
      const personId = resolvePersonId(p.personNameNormalized);
      const edgeKey = `${personId}||${companyId}||${p.position}`;
      if (!linkMap.has(edgeKey)) {
        linkMap.set(edgeKey, {
          source: personId,
          target: companyId,
          position: p.position,
          startYear: p.startYear,
          endYear: p.endYear,
          projects: p.projects,
          coworkers: p.coworkers,
          reportsTo: p.reportsTo,
        });
      }
    }
  }

  const nodes = [...personNodeMap.values(), ...companyNodeMap.values()];
  return { nodes, links: Array.from(linkMap.values()) };
}

/**
 * Check if a person has been fully researched (expanded).
 */
export function hasPerson(nameNormalized: string): boolean {
  if (!isBrowser()) return false;
  const persons = getPersons();
  const key = findMatchingKey(Object.keys(persons), nameNormalized);
  return key ? persons[key].expanded === true : false;
}

/**
 * Check if a company has been fully researched (expanded).
 */
export function hasCompany(nameNormalized: string): boolean {
  if (!isBrowser()) return false;
  const companies = getCompanies();
  const key = findMatchingKey(Object.keys(companies), nameNormalized);
  return key ? companies[key].expanded === true : false;
}

/**
 * Get the names of people already known for a company.
 */
export function getCompanyPeopleNames(companyNormalized: string): string[] {
  if (!isBrowser()) return [];
  const companies = getCompanies();
  const key = findMatchingKey(Object.keys(companies), companyNormalized);
  if (!key) return [];
  return companies[key].notablePeople.map(p => p.personName);
}

/**
 * Get the names of companies already known for a person.
 */
export function getPersonCompanyNames(personNormalized: string): string[] {
  if (!isBrowser()) return [];
  const persons = getPersons();
  const key = findMatchingKey(Object.keys(persons), personNormalized);
  if (!key) return [];
  return persons[key].companies.map(c => c.companyName);
}

/**
 * Get the active LLM provider from localStorage settings.
 */
export function getActiveProvider(): string {
  const settings = getSettings();
  return settings.activeProvider || 'anthropic';
}

/**
 * Set the active LLM provider in localStorage settings.
 */
export function setActiveProvider(provider: string): void {
  const settings = getSettings();
  settings.activeProvider = provider;
  setSettings(settings);
}

/**
 * Update the photo URL for a person found by normalized name.
 */
export function updatePersonPhoto(nameNormalized: string, photoUrl: string | null): void {
  if (!isBrowser()) return;
  const persons = getPersons();
  const key = findMatchingKey(Object.keys(persons), nameNormalized);
  if (!key) return;
  persons[key].photoUrl = photoUrl;
  setPersons(persons);
}

/**
 * Clear all graph data (persons + companies) but keep settings.
 */
export function clearGraph(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(PERSONS_KEY);
  localStorage.removeItem(COMPANIES_KEY);
}

/**
 * Export the raw localStorage graph blobs for saving/sharing.
 */
export function exportGraph(): { persons: unknown; companies: unknown } {
  if (!isBrowser()) return { persons: {}, companies: {} };
  try {
    return {
      persons: JSON.parse(localStorage.getItem(PERSONS_KEY) || '{}'),
      companies: JSON.parse(localStorage.getItem(COMPANIES_KEY) || '{}'),
    };
  } catch {
    return { persons: {}, companies: {} };
  }
}

/**
 * Import graph blobs into localStorage, replacing existing data.
 */
export function importGraph(persons: unknown, companies: unknown): void {
  if (!isBrowser()) return;
  localStorage.setItem(PERSONS_KEY, JSON.stringify(persons));
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
}

/**
 * Return display names + normalized keys of all stored companies (for the merge picker).
 */
export function getCompanyNames(): { name: string; norm: string }[] {
  if (!isBrowser()) return [];
  const companies = getCompanies();
  return Object.values(companies).map(c => ({ name: c.name, norm: c.nameNormalized }));
}

/**
 * Merge source company into target company:
 * - Merge metadata (keep target's non-empty fields, fill gaps from source)
 * - Update target display name to "Target (Source)"
 * - Move source's notablePeople into target (dedup by personNameNormalized)
 * - Rewrite every person's companies[] entries from source → target
 * - Delete the source company entry
 */
export function mergeCompanies(sourceNorm: string, targetNorm: string): void {
  if (!isBrowser()) return;

  const persons = getPersons();
  const companies = getCompanies();

  const sourceKey = findMatchingKey(Object.keys(companies), sourceNorm);
  const targetKey = findMatchingKey(Object.keys(companies), targetNorm);
  if (!sourceKey || !targetKey || sourceKey === targetKey) return;

  const source = companies[sourceKey];
  const target = companies[targetKey];

  // Merge metadata: keep target's non-empty fields, fill gaps from source
  target.description = target.description || source.description;
  target.products = target.products || source.products;
  target.history = target.history || source.history;
  target.logoUrl = target.logoUrl || source.logoUrl;

  // Update display name to "Target (Source)"
  target.name = `${target.name} (${source.name})`;

  // Merge notablePeople (dedup by personNameNormalized)
  const existingNorms = new Set(target.notablePeople.map(p => p.personNameNormalized));
  for (const p of source.notablePeople) {
    if (!existingNorms.has(p.personNameNormalized)) {
      target.notablePeople.push(p);
      existingNorms.add(p.personNameNormalized);
    }
  }

  // Rewrite every person's companies[] entries from source → target
  for (const person of Object.values(persons)) {
    for (const c of person.companies) {
      if (c.companyNameNormalized === sourceKey) {
        c.companyNameNormalized = targetKey;
        c.companyName = target.name;
      }
    }
  }

  // Delete the source company
  delete companies[sourceKey];

  setPersons(persons);
  setCompanies(companies);
}

/**
 * Extract normalized name from a graph node ID.
 * Node IDs are formatted as "person:norm" or "company:norm".
 */
export function normFromNodeId(id: string): string {
  const idx = id.indexOf(':');
  return idx >= 0 ? id.slice(idx + 1) : id;
}
