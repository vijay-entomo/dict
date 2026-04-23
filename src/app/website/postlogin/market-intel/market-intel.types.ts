
export interface MarketRole {
  title: string;
  growth: string;
  progress: number;
  entryLevel: string;
  advancedLevel: string;
  skills: string[];
  careerPath: {
    intern: { title: string; description: string };
    junior: { title: string; description: string };
    senior: { title: string; description: string };
    csuite: { title: string; description: string };
  };
}

export const PLACEHOLDER_WORDS = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'UX Designer',
  'Embedded Systems Engineer',
  'Financial Analyst',
  'VLSI Engineer',
  'Digital Marketer'
];

export const ALL_FIELDS = [
  // Technology
  'Software Engineering', 'Data Science', 'Cybersecurity', 'Cloud Computing', 'Artificial Intelligence',
  'Mobile Development', 'DevOps', 'Blockchain', 'Full Stack Development', 'Frontend Development',
  'Backend Development', 'Game Development', 'Embedded Systems', 'IoT Engineering', 'AR/VR Development',
  
  // Business & Finance
  'Finance', 'Investment Banking', 'Asset Management', 'Accounting', 'Strategic Management',
  'Entrepreneurship', 'Venture Capital', 'Supply Chain Management', 'Risk Management', 'Actuarial Science',
  'Market Research', 'Project Management', 'Consulting', 'Real Estate', 'Logistics',
  
  // Marketing & Creative
  'Digital Marketing', 'Content Strategy', 'Public Relations', 'UI/UX Design', 'Graphic Design',
  'Copywriting', 'Social Media Management', 'Brand Management', 'Video Production', 'Animation',
  'Photography', 'Fashion Design', 'Interior Design', 'Product Design', 'Advertising',
  
  // Healthcare & Science
  'Medicine', 'Nursing', 'Pharmacy', 'Biotechnology', 'Public Health',
  'Pharmacology', 'Biomedical Engineering', 'Genetics', 'Psychology', 'Clinical Research',
  'Dentistry', 'Physiotherapy', 'Nutrition', 'Neuroscience', 'Epidemiology',
  
  // Engineering & Industry
  'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Aerospace Engineering', 'Chemical Engineering',
  'Embedded Systems', 'VLSI Design', 'Semiconductor Engineering', 'Renewable Energy', 'Architecture', 'Robotics',
  'Automotive Engineering', 'Structural Engineering', 'Industrial Engineering', 'Environmental Engineering',
  
  // Hospitality & Law
  'Hospitality Management', 'Culinary Arts', 'Tourism', 'Event Planning', 'Law',
  'Corporate Law', 'Criminal Justice', 'International Relations', 'Political Science', 'Public Policy',
  'Journalism', 'Education', 'Sociology', 'Anthropology', 'Social Work'
];
