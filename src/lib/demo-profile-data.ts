import {
  EDUCATION_OPTIONS,
  LANGUAGE_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
  RELIGION_OPTIONS,
} from "@/lib/constants";
import { INTEREST_OPTIONS } from "@/lib/membership";

export type DemoGender = "man" | "woman";

export const DEMO_COUNTRIES = [
  "Kenya",
  "Uganda",
  "Tanzania",
  "Rwanda",
  "Nigeria",
  "South Africa",
  "USA",
  "Canada",
  "UK",
  "India",
] as const;

export const DEMO_NAME_LIBRARY: Record<
  (typeof DEMO_COUNTRIES)[number],
  Record<DemoGender, string[]>
> = {
  Kenya: {
    man: ["Brian", "Kevin", "Eric", "Daniel", "Samuel", "Victor", "Ian", "Joseph"],
    woman: ["Faith", "Mercy", "Sharon", "Amina", "Grace", "Wanjiku", "Naomi", "Lilian"],
  },
  Uganda: {
    man: ["David", "Isaac", "Allan", "Moses", "Peter", "Ivan", "Henry", "Martin"],
    woman: ["Brenda", "Esther", "Patricia", "Sarah", "Joan", "Ruth", "Doreen", "Mariam"],
  },
  Tanzania: {
    man: ["Juma", "Hassan", "Joseph", "Baraka", "Emmanuel", "Amani", "Kelvin", "Musa"],
    woman: ["Neema", "Rehema", "Asha", "Zawadi", "Upendo", "Janet", "Glory", "Halima"],
  },
  Rwanda: {
    man: ["Claude", "Eric", "Patrick", "Jean", "Olivier", "Emmanuel", "Aimable", "Fabrice"],
    woman: ["Chantal", "Diane", "Alice", "Claudine", "Aline", "Grace", "Sandrine", "Divine"],
  },
  Nigeria: {
    man: ["David", "Chinedu", "Tunde", "Emeka", "Samuel", "Ibrahim", "Femi", "Daniel"],
    woman: ["Amara", "Aisha", "Chioma", "Kemi", "Blessing", "Ngozi", "Zainab", "Temi"],
  },
  "South Africa": {
    man: ["Thabo", "Sipho", "Lungile", "Mandla", "Kagiso", "Sibusiso", "Johan", "Daniel"],
    woman: ["Nomsa", "Lerato", "Thandi", "Zanele", "Anele", "Naledi", "Michelle", "Priya"],
  },
  USA: {
    man: ["Michael", "Daniel", "James", "Anthony", "Christopher", "Jordan", "Marcus", "Ryan"],
    woman: ["Emily", "Maya", "Ashley", "Jessica", "Olivia", "Sophia", "Lauren", "Rachel"],
  },
  Canada: {
    man: ["Matthew", "Joshua", "Ethan", "Noah", "Liam", "Owen", "Daniel", "Lucas"],
    woman: ["Emma", "Ava", "Chloe", "Sophie", "Grace", "Mia", "Olivia", "Amelia"],
  },
  UK: {
    man: ["Oliver", "Harry", "George", "Thomas", "Jack", "James", "William", "Daniel"],
    woman: ["Amelia", "Isla", "Ava", "Grace", "Freya", "Olivia", "Charlotte", "Sophie"],
  },
  India: {
    man: ["Arjun", "Rahul", "Amit", "Rohan", "Vikram", "Aditya", "Kiran", "Sanjay"],
    woman: ["Priya", "Anika", "Meera", "Asha", "Nisha", "Kavya", "Riya", "Divya"],
  },
};

export const DEMO_CITY_LIBRARY: Record<(typeof DEMO_COUNTRIES)[number], string[]> = {
  Kenya: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
  Uganda: ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu"],
  Tanzania: ["Dar es Salaam", "Arusha", "Dodoma", "Mwanza", "Zanzibar"],
  Rwanda: ["Kigali", "Huye", "Musanze", "Rubavu", "Muhanga"],
  Nigeria: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Gqeberha"],
  USA: ["Atlanta", "Chicago", "Dallas", "New York", "Seattle", "Washington"],
  Canada: ["Toronto", "Vancouver", "Calgary", "Ottawa", "Montreal"],
  UK: ["London", "Manchester", "Birmingham", "Leeds", "Bristol"],
  India: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad"],
};

const OCCUPATIONS = [
  "Product designer",
  "Teacher",
  "Software developer",
  "Healthcare coordinator",
  "Financial analyst",
  "Civil engineer",
  "Marketing strategist",
  "Small business owner",
  "Project manager",
  "Hospitality manager",
  "Community organizer",
  "Graduate student",
] as const;

const BIO_OPENERS = [
  "I value kindness, consistency, and conversations that keep going after dinner.",
  "I am building a steady life and hoping to meet someone intentional.",
  "I like simple plans, thoughtful people, and relationships that feel peaceful.",
  "Friends describe me as warm, curious, and dependable.",
  "I am happiest around good food, honest conversation, and people with a sense of purpose.",
] as const;

const BIO_DETAILS = [
  "Weekends usually include music, a long walk, or trying a new place in the city.",
  "I enjoy learning new things and making time for family.",
  "I care about faith, personal growth, and showing up when it matters.",
  "I am drawn to people who communicate clearly and laugh easily.",
  "Travel, books, and meaningful work keep me energized.",
] as const;

export function pickDemoName(country: string, gender: string, seed = Date.now()) {
  const names =
    DEMO_NAME_LIBRARY[country as keyof typeof DEMO_NAME_LIBRARY]?.[
      gender === "man" ? "man" : "woman"
    ] ?? DEMO_NAME_LIBRARY.Kenya.woman;
  return names[Math.abs(seed) % names.length];
}

export function generateDemoProfile(country: string, gender: string, index = 0) {
  const resolvedCountry =
    country === "Any supported country" || !country
      ? DEMO_COUNTRIES[index % DEMO_COUNTRIES.length]
      : country;
  const resolvedGender = gender === "Mixed" ? (index % 2 === 0 ? "woman" : "man") : gender;
  const firstName = pickDemoName(resolvedCountry, resolvedGender, index);
  const cityList =
    DEMO_CITY_LIBRARY[resolvedCountry as keyof typeof DEMO_CITY_LIBRARY] ?? DEMO_CITY_LIBRARY.Kenya;
  const city = cityList[index % cityList.length];
  const age = 23 + ((index * 7) % 24);
  const occupation = OCCUPATIONS[(index * 5) % OCCUPATIONS.length];
  const interests = Array.from(
    new Set([
      INTEREST_OPTIONS[(index * 2) % INTEREST_OPTIONS.length],
      INTEREST_OPTIONS[(index * 3 + 4) % INTEREST_OPTIONS.length],
      INTEREST_OPTIONS[(index * 5 + 7) % INTEREST_OPTIONS.length],
    ]),
  );
  const languages = Array.from(
    new Set(["English", LANGUAGE_OPTIONS[(index * 3) % LANGUAGE_OPTIONS.length]]),
  );

  return {
    displayName: firstName,
    age,
    gender: resolvedGender,
    interestedIn: ["everyone"],
    country: resolvedCountry,
    city,
    bio: `${BIO_OPENERS[index % BIO_OPENERS.length]} ${BIO_DETAILS[(index * 2) % BIO_DETAILS.length]}`,
    occupation,
    religion: RELIGION_OPTIONS[(index * 3) % RELIGION_OPTIONS.length].value,
    education: EDUCATION_OPTIONS[(index * 5) % EDUCATION_OPTIONS.length].value,
    relationshipGoal:
      RELATIONSHIP_GOAL_OPTIONS[(index * 2) % RELATIONSHIP_GOAL_OPTIONS.length].value,
    interests,
    languages,
    latitude: null,
    longitude: null,
    lastActive: new Date(Date.now() - ((index * 47) % 10080) * 60000).toISOString(),
    isVerified: index % 4 === 0,
    membershipTier: index % 5 === 0 ? "gold" : "free",
    isActive: true,
  } as const;
}
