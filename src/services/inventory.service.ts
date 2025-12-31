// src/services/inventory.service.ts
import { INVENTORY } from '../db/mock';
import { InventoryItem } from '../types';

export class InventoryService {
  /**
   * Search inventory by query string
   * Matches against model name and category with smart plural handling
   */
  search(query: string): InventoryItem[] {
    if (!query) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();

    // Smart matching: handle plurals, synonyms, common variations
    const queryVariations = [
      normalizedQuery,
      normalizedQuery.replace(/s$/, ''),  // Remove trailing 's' (excavators -> excavator)
      normalizedQuery.replace(/es$/, ''), // Remove trailing 'es' (dozers -> dozer)
      normalizedQuery.replace(/bulldozer/g, 'dozer'), // bulldozer = dozer
      normalizedQuery.replace(/loader/g, 'wheel loader'), // common variation
    ];

    return INVENTORY.filter(item => {
      const model = item.model.toLowerCase();
      const category = item.category.toLowerCase();

      // Check if any query variation matches model or category
      return queryVariations.some(variation =>
        model.includes(variation) ||
        category.includes(variation) ||
        variation.includes(model) ||
        variation.includes(category)
      );
    });
  }

  /**
   * Get all available inventory
   */
  getAvailable(): InventoryItem[] {
    return INVENTORY.filter(item => item.available > 0);
  }

  /**
   * Get inventory by category
   */
  getByCategory(category: string): InventoryItem[] {
    return INVENTORY.filter(item =>
      item.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Format a single item with RICH data (availability, price, condition, specs, etc.)
   * This is the "One Smart Tool" approach - return everything in one shot
   */
  formatItemRich(item: InventoryItem): string {
    const parts: string[] = [];

    // Model and category
    parts.push(`${item.model} ${item.category}`);

    // Availability (CRITICAL)
    if (item.available > 0) {
      parts.push(`${item.available} available`);
    } else {
      parts.push(`currently unavailable`);
    }

    // Price
    parts.push(`$${item.price_per_day} per day`);

    // Condition if available
    if (item.condition) {
      parts.push(`${item.condition} condition`);
    }

    // Year if available
    if (item.year) {
      parts.push(`${item.year} model`);
    }

    // Specs if available
    if (item.specs) {
      parts.push(`(${item.specs})`);
    }

    return parts.join(', ');
  }

  /**
   * Smart sort items based on query intent
   * - "cheap" or "affordable" -> sort by price ascending
   * - "new" or "latest" -> sort by year descending
   * - default -> sort by availability (most available first)
   */
  smartSort(items: InventoryItem[], query: string): InventoryItem[] {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('cheap') || lowerQuery.includes('affordable') || lowerQuery.includes('budget')) {
      // Sort by price: cheapest first
      return [...items].sort((a, b) => a.price_per_day - b.price_per_day);
    }

    if (lowerQuery.includes('new') || lowerQuery.includes('latest') || lowerQuery.includes('newest')) {
      // Sort by year: newest first
      return [...items].sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    if (lowerQuery.includes('best') || lowerQuery.includes('top') || lowerQuery.includes('excellent')) {
      // Sort by condition: Excellent first
      return [...items].sort((a, b) => {
        const conditionRank = { 'Excellent': 3, 'Good': 2, 'Fair': 1 };
        return (conditionRank[b.condition as keyof typeof conditionRank] || 0) -
               (conditionRank[a.condition as keyof typeof conditionRank] || 0);
      });
    }

    // Default: sort by availability (most available first)
    return [...items].sort((a, b) => b.available - a.available);
  }

  /**
   * Build summary response for large result sets (6+ items)
   * Returns: count, price range, top 3 picks, clarifying question
   */
  buildSummary(items: InventoryItem[], query: string): string {
    const count = items.length;
    const prices = items.map(i => i.price_per_day);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Smart sort and get top 3
    const sorted = this.smartSort(items, query);
    const top3 = sorted.slice(0, 3);

    const response: string[] = [];

    // Summary line
    response.push(`I found ${count} machines matching "${query}".`);
    response.push(`Prices range from $${minPrice} to $${maxPrice} per day.`);

    // Top 3 picks
    response.push(`Here are my top 3 recommendations:`);
    top3.forEach((item, idx) => {
      response.push(`${idx + 1}. ${this.formatItemRich(item)}`);
    });

    // Clarifying question to narrow down
    response.push(`Would you like to narrow this down by size, price range, or year?`);

    return response.join(' ');
  }

  /**
   * Search and format results for tool response
   * HYBRID APPROACH:
   * - 0 results: Not available message
   * - 1-5 results: Full rich details for all
   * - 6+ results: Summary mode with top 3 recommendations
   *
   * SMART SORTING:
   * - Detects "cheap" in query -> sorts by price
   * - Detects "new" in query -> sorts by year
   * - Default -> sorts by availability
   */
  searchAndFormat(query: string): string {
    const matches = this.search(query);

    // TIER 1: No results
    if (matches.length === 0) {
      return `I checked the lot, but I don't see any ${query} available right now. I can connect you with a manager to check other options.`;
    }

    // Separate available vs unavailable items
    const available = matches.filter(m => m.available > 0);
    const unavailable = matches.filter(m => m.available === 0);

    // TIER 4: 6+ results -> Summary mode
    if (available.length >= 6) {
      return this.buildSummary(available, query);
    }

    // TIER 2 & 3: 1-5 results -> Full details
    const response: string[] = [];

    if (available.length > 0) {
      // Smart sort even for small lists
      const sorted = this.smartSort(available, query);

      if (sorted.length === 1) {
        const item = sorted[0];
        response.push(`Yes, we have the ${this.formatItemRich(item)}.`);
      } else {
        response.push(`We have ${sorted.length} options:`);
        sorted.forEach((item, idx) => {
          response.push(`${idx + 1}. ${this.formatItemRich(item)}`);
        });
      }
    }

    // Mention unavailable items (in case they ask about specific model)
    if (unavailable.length > 0 && unavailable.length < 3) {
      unavailable.forEach(item => {
        response.push(`The ${item.model} is currently unavailable, but usually rents for $${item.price_per_day}/day.`);
      });
    }

    return response.join(' ');
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
