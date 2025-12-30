// src/db/mock.ts

import { Customer, InventoryItem } from '../types';

// 1. CRM DATA
export const CONTACTS: Record<string, Customer> = {
  // TEST NUMBER: Replace with your actual cell phone!
  "+16025705474": {
    name: "Abhave",
    company: "Tex Intel HQ",
    last_machine: "Cat 336 Excavator",
    status: "VIP"
  },
  // Example Customers
  "+15125559999": {
    name: "Bob Builder",
    company: "Austin Construction",
    last_machine: "Skid Steer",
    status: "New"
  },
  "+14695558888": {
    name: "Sarah Martinez",
    company: "Dallas Demolition Co",
    last_machine: "Cat D6 Dozer",
    status: "VIP"
  },
  "+17135557777": {
    name: "Mike Johnson",
    company: "Houston Heavy Haul",
    last_machine: "Dump Truck",
    status: "New"
  }
};

// 2. INVENTORY DATA
export const INVENTORY: InventoryItem[] = [
  {
    model: "Cat 336",
    category: "Excavator",
    available: 2,
    price_per_day: 1200,
    condition: "Excellent",
    year: 2022,
    specs: "36-ton, 268hp, 24ft dig depth"
  },
  {
    model: "Cat 320",
    category: "Excavator",
    available: 3,
    price_per_day: 950,
    condition: "Good",
    year: 2021,
    specs: "20-ton, 121hp, 20ft dig depth"
  },
  {
    model: "Cat D6",
    category: "Dozer",
    available: 0,
    price_per_day: 900,
    condition: "Good",
    year: 2020,
    specs: "160hp, 14ft blade"
  },
  {
    model: "Cat D8",
    category: "Dozer",
    available: 1,
    price_per_day: 1400,
    condition: "Excellent",
    year: 2023,
    specs: "305hp, 16ft blade, GPS ready"
  },
  {
    model: "Bobcat T76",
    category: "Skid Steer",
    available: 5,
    price_per_day: 350,
    condition: "Good",
    year: 2021,
    specs: "74hp, 3,000lb capacity"
  },
  {
    model: "Bobcat S650",
    category: "Skid Steer",
    available: 4,
    price_per_day: 300,
    condition: "Fair",
    year: 2019,
    specs: "74hp, 2,300lb capacity"
  },
  {
    model: "JCB 3CX",
    category: "Backhoe",
    available: 2,
    price_per_day: 500,
    condition: "Good",
    year: 2020,
    specs: "97hp, 4WD, extendable arm"
  },
  {
    model: "Cat 950M",
    category: "Loader",
    available: 2,
    price_per_day: 850,
    condition: "Excellent",
    year: 2022,
    specs: "220hp, 5-yard bucket"
  },
  {
    model: "Volvo A40G",
    category: "Dump Truck",
    available: 3,
    price_per_day: 1100,
    condition: "Good",
    year: 2021,
    specs: "38-ton capacity, articulated"
  },
  {
    model: "Manitowoc 18000",
    category: "Crane",
    available: 1,
    price_per_day: 2500,
    condition: "Excellent",
    year: 2023,
    specs: "440-ton capacity, crawler mounted"
  },
  // Additional Skid Steers to test summary mode (6+ results)
  {
    model: "Bobcat S570",
    category: "Skid Steer",
    available: 3,
    price_per_day: 275,
    condition: "Good",
    year: 2020,
    specs: "66hp, 2,000lb capacity"
  },
  {
    model: "Cat 262D",
    category: "Skid Steer",
    available: 2,
    price_per_day: 400,
    condition: "Excellent",
    year: 2023,
    specs: "90hp, 3,300lb capacity"
  },
  {
    model: "John Deere 332G",
    category: "Skid Steer",
    available: 4,
    price_per_day: 380,
    condition: "Good",
    year: 2022,
    specs: "100hp, 3,700lb capacity"
  },
  {
    model: "Kubota SSV75",
    category: "Skid Steer",
    available: 2,
    price_per_day: 320,
    condition: "Fair",
    year: 2019,
    specs: "74hp, 2,590lb capacity"
  }
];
