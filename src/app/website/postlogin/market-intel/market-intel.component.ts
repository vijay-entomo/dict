import { Component, ChangeDetectorRef, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketRole, PLACEHOLDER_WORDS, ALL_FIELDS } from './market-intel.types';
import { COUNTRIES } from './countries';


@Component({
  selector: 'app-market-intel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './market-intel.component.html',
  styleUrl: './market-intel.component.scss'
})
export class MarketIntelComponent implements OnInit, OnDestroy {
  @Output() roleSelected = new EventEmitter<MarketRole>();

  showQuestionnaire = true;
  fieldInput = '';
  suggestions: string[] = [];
  isLoadingMI = false;
  miError = '';
  animatedPlaceholder = PLACEHOLDER_WORDS[0];
  private placeholderIndex = 0;
  private placeholderIntervalId: any;

  trendingRoles: MarketRole[] = [];
  selectedRole: MarketRole | null = null;
  selectedField = '';

  countries = ['Global', ...COUNTRIES];
  selectedCountry = 'Global';
  countrySearch = '';
  countryDropdownOpen = false;
  filteredCountries = this.countries;


  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.startPlaceholderAnimation();
  }

  ngOnDestroy() {
    if (this.placeholderIntervalId) clearInterval(this.placeholderIntervalId);
  }

  startPlaceholderAnimation() {
    this.placeholderIntervalId = setInterval(() => {
      this.placeholderIndex = (this.placeholderIndex + 1) % PLACEHOLDER_WORDS.length;
      this.animatedPlaceholder = PLACEHOLDER_WORDS[this.placeholderIndex];
      this.cdr.detectChanges();
    }, 2000);
  }

  onFieldInput() {
    const q = this.fieldInput.trim().toLowerCase();
    if (q.length < 1) { this.suggestions = []; return; }
    this.suggestions = ALL_FIELDS
      .filter(f => f.toLowerCase().includes(q))
      .slice(0, 7);
  }

  selectSuggestion(s: string) {
    this.fieldInput = s;
    this.suggestions = [];
    this.generateMI();
  }

  onCountrySearch() {
    this.filteredCountries = this.countries.filter(c =>
      c.toLowerCase().includes(this.countrySearch.toLowerCase())
    );
  }

  selectCountry(c: string) {
    this.selectedCountry = c;
    this.countryDropdownOpen = false;
    this.countrySearch = '';
    this.filteredCountries = this.countries;
  }

  toggleCountryDropdown() {
    this.countryDropdownOpen = !this.countryDropdownOpen;
    if (this.countryDropdownOpen) {
      setTimeout(() => {
        const input = document.getElementById('country-search-input');
        if (input) input.focus();
      }, 0);
    }
  }

  async generateMI() {

    const field = this.fieldInput.trim();
    if (!field) return;
    this.isLoadingMI = true;
    this.miError = '';
    this.suggestions = [];
    this.cdr.detectChanges();

    const systemPrompt = `You are a career market intelligence API. You MUST respond with ONLY raw JSON — no markdown, no code fences, no explanation.`;

    const userPrompt = `Generate EXPERT-LEVEL, LOCALISED market intelligence for: "${field}" in ${this.selectedCountry}.
Your data must match the reliability of Glassdoor, Indeed, and Google Careers.

Output ONLY this JSON structure with 4 HIGH-ACCURACY roles:
{"roles":[{"title":"string","growth":"+XX%","progress":75,"entryLevel":"LOCAL_CURRENCY_SYMBOL Amount","advancedLevel":"LOCAL_CURRENCY_SYMBOL Amount","skills":["s1","s2","s3","s4","s5"],"careerPath":{"intern":{"title":"REAL JOB TITLE","description":"Specific role responsibility"},"junior":{"title":"REAL JOB TITLE","description":"Specific role responsibility"},"senior":{"title":"REAL JOB TITLE","description":"Specific role responsibility"},"csuite":{"title":"REAL JOB TITLE","description":"Specific role responsibility"}}}]}

STRICT DATA RULES:
1. CURRENCY: Use the ACTUAL local currency symbol and format of ${this.selectedCountry} (e.g., ₱ for Philippines, ₹ for India, $ for USA).
2. REALISM: For ${this.selectedCountry}, ensure Entry Level and Advanced Level salaries reflect REAL ANNUAL PAY. 
   - Example: For Data Science in Philippines, Entry Level is approx ₱300k - ₱500k.
   - Do NOT use USD values for non-USD countries unless specified.
3. RELIABILITY: Data MUST be consistent with high-end career platforms (Payscale, Indeed).
4. ROLES: Use precise, localized job titles (e.g., "Data Scientist I", "Lead Data Science Architect").
5. Format salary amounts clearly (e.g., "₱450k", "₹12L", "$95k").`;



    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer YOUR_GROQ_API_KEY',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.4,
          max_tokens: 2048,
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) {
        throw new Error(`API ${resp.status}`);
      }

      const data = await resp.json();
      const raw = (data.choices?.[0]?.message?.content ?? '').trim();

      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON');
      const parsed = JSON.parse(raw.slice(start, end + 1));

      this.trendingRoles = parsed.roles;
      this.selectRole(this.trendingRoles[0]);
      this.selectedField = field;
      this.showQuestionnaire = false;
      this.isLoadingMI = false;
      this.cdr.detectChanges();
    } catch (err: any) {
      this.isLoadingMI = false;
      console.error('[Groq MI Error]', err);
      this.trendingRoles = this.buildFallbackRoles(field);
      this.selectRole(this.trendingRoles[0]);
      this.selectedField = field;
      this.showQuestionnaire = false;
      this.cdr.detectChanges();
    }
  }

  buildFallbackRoles(field: string): MarketRole[] {
    const f = field;
    return [
      {
        title: `${f} Analyst`, growth: '+34%', progress: 65,
        entryLevel: '$55k', advancedLevel: '$130k',
        skills: ['Analysis', 'Communication', 'Data Interpretation', 'Reporting', 'Strategy'],
        careerPath: {
          intern:  { title: `${f} Analyst Intern`,       description: `Assist senior analysts with data collection.` },
          junior:  { title: `${f} Analyst`,              description: `Own analytical projects.` },
          senior:  { title: `Senior ${f} Analyst`,       description: `Lead analytical strategy.` },
          csuite:  { title: `VP / Director of ${f}`,     description: `Define the analytics vision.` },
        }
      },
      {
        title: `${f} Specialist`, growth: '+28%', progress: 55,
        entryLevel: '$60k', advancedLevel: '$140k',
        skills: ['Expertise', 'Problem-Solving', 'Stakeholder Management'],
        careerPath: {
          intern:  { title: `${f} Graduate Trainee`,     description: `Rotate across ${f} teams.` },
          junior:  { title: `${f} Specialist`,           description: `Manage ${f} projects.` },
          senior:  { title: `Senior ${f} Specialist`,    description: `Mentor junior specialists.` },
          csuite:  { title: `Head of ${f}`,              description: `Oversee the entire ${f} function.` },
        }
      }
    ];
  }

  selectRole(role: MarketRole) {
    this.selectedRole = role;
    this.roleSelected.emit(role);
    this.cdr.detectChanges();
  }

  resetQuestionnaire() {
    this.showQuestionnaire = true;
    this.fieldInput = '';
    this.trendingRoles = [];
    this.selectedRole = null;
    this.miError = '';
    this.cdr.detectChanges();
  }
}
