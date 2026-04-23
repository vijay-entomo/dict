import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Header } from "../header/header";
import { ThemeScrollDirective } from "../../directive/theme-scroll.directive";
import { InteractiveGrid } from "../../components/interactive-grid/interactive-grid";
import { CommonModule } from '@angular/common';
import { HorizontalScrollDirective } from '../../directive/stacking-card.directive';
import { ScrollProgressDirective } from '../../directive/scroll-progress.directive';
import { ScrollActivateClassDirective } from '../../directive/scroll-activate-class.directive';
import { ColorTextComponent } from '../../components/color-title/color-title';
import { MarketIntelComponent } from './market-intel/market-intel.component';

@Component({
  selector: 'app-postlogin',
  imports: [
    CommonModule,
    ThemeScrollDirective,
    InteractiveGrid,
    ScrollProgressDirective,
    ScrollActivateClassDirective,
    ColorTextComponent,
    Header,
    MarketIntelComponent,
  ],
  templateUrl: './postlogin.html',
  styleUrl: './postlogin.scss',
})
export class Postlogin implements AfterViewInit, OnDestroy {
  @ViewChild('trendingList') trendingListRef!: ElementRef;
  private autoChangeIntervalId: any;
  private autoChangeTimeoutId: any;

  careerPathData = {
    intern: {
      title: 'Entry Level',
      description:
        'Select a role from Market Intelligence above to see your personalised career progression.',
    },
    junior: {
      title: 'Junior',
      description:
        'Click any trending role to reveal the career journey from entry level to executive leadership.',
    },
    senior: {
      title: 'Senior',
      description:
        'Each role comes with real-world titles and descriptions specific to that career track.',
    },
    csuite: {
      title: 'Executive',
      description: 'Your path to the top — tailored to the market role you choose.',
    },
  };

  trendingRoles: any[] = [];
  selectedRole: any = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.startAutoChange();
  }

  ngOnDestroy() {
    this.stopAutoChange();
  }

  startAutoChange() {
    // Add an extra check for browser environment or just let it run
    this.autoChangeTimeoutId = setTimeout(() => {
      let seconds = 5;
      if (this.trendingListRef && this.trendingListRef.nativeElement) {
        const secondsAttr = this.trendingListRef.nativeElement.getAttribute(
          'data-auto-change-seconds',
        );
        if (secondsAttr) {
          seconds = parseInt(secondsAttr, 10) || 5;
        }
      }

      this.autoChangeIntervalId = setInterval(() => {
        const currentIndex = this.trendingRoles.findIndex((r) => r.id === this.selectedRole.id);
        const nextIndex = (currentIndex + 1) % this.trendingRoles.length;
        this.selectedRole = this.trendingRoles[nextIndex];
        this.cdr.detectChanges(); // Force angular to detect changes
      }, seconds * 1000);
    }, 100); // Wait for the view to fully initialize
  }

  stopAutoChange() {
    if (this.autoChangeTimeoutId) {
      clearTimeout(this.autoChangeTimeoutId);
      this.autoChangeTimeoutId = null;
    }
    if (this.autoChangeIntervalId) {
      clearInterval(this.autoChangeIntervalId);
      this.autoChangeIntervalId = null;
    }
  }

  selectRole(role: any) {
    this.selectedRole = role;

    if (role?.careerPath) {
      this.careerPathData = {
        intern: role.careerPath.intern,
        junior: role.careerPath.junior,
        senior: role.careerPath.senior,
        csuite: role.careerPath.csuite,
      };
    }

    this.stopAutoChange();
    this.cdr.detectChanges();
    this.startAutoChange(); // Restart the timer when clicked
  }

  pathwayRoles = [
    {
      title: 'Geological Engineer',
      description: "Exploring and extracting earth's resources safely and efficiently.",
      img: 'https://images.unsplash.com/photo-1632433293858-7d78538b231c?q=80&w=2064&auto=format&fit=crop',
    },
    {
      title: 'Environmental Scientist',
      description: 'Protecting human health and the environment by analyzing ecosystems.',
      img: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2064&auto=format&fit=crop',
    },
    {
      title: 'Data Analyst',
      description: 'Transforming complex data into actionable business intelligence.',
      img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2064&auto=format&fit=crop',
    },
    {
      title: 'Urban Planner',
      description: 'Designing sustainable, efficient, and beautiful cities for the future.',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2064&auto=format&fit=crop',
    },
  ];

  activePathwayIndex = 0;

  get activePathway() {
    return this.pathwayRoles[this.activePathwayIndex];
  }

  nextPathway() {
    this.activePathwayIndex = (this.activePathwayIndex + 1) % this.pathwayRoles.length;
  }

  prevPathway() {
    this.activePathwayIndex =
      (this.activePathwayIndex - 1 + this.pathwayRoles.length) % this.pathwayRoles.length;
  }

  trendingSkills = [
    {
      id: 1,
      title: 'Enhance your skills',
      description:
        'Take a comprehensive adaptive assessment to benchmark your proficiency, identify skill gaps, and receive a personalised learning roadmap built for your career trajectory.',
      img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=2070&auto=format&fit=crop',
      tags: ['Problem Solving', 'Domain Knowledge', 'Critical Thinking'],
      duration: '45 Mins',
      difficulty: 'Advanced',
    },
  ];
}
