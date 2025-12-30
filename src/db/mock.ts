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
  { model: "Cat 336", category: "Excavator", available: 2, price_per_day: 1200 },
  { model: "Cat 320", category: "Excavator", available: 3, price_per_day: 950 },
  { model: "Cat D6", category: "Dozer", available: 0, price_per_day: 900 },
  { model: "Cat D8", category: "Dozer", available: 1, price_per_day: 1400 },
  { model: "Bobcat T76", category: "Skid Steer", available: 5, price_per_day: 350 },
  { model: "Bobcat S650", category: "Skid Steer", available: 4, price_per_day: 300 },
  { model: "JCB 3CX", category: "Backhoe", available: 2, price_per_day: 500 },
  { model: "Cat 950M", category: "Loader", available: 2, price_per_day: 850 },
  { model: "Volvo A40G", category: "Dump Truck", available: 3, price_per_day: 1100 },
  { model: "Manitowoc 18000", category: "Crane", available: 1, price_per_day: 2500 }
];
