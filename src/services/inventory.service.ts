// src/services/inventory.service.ts
import { databaseService } from './database.service';
import { InventoryItem } from '../types';

export class InventoryService {
  /**
   * Search inventory by query string (from database)
   * Handles smart matching with plurals and synonyms
   */
  async search(query: string): Promise<any[]> {
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

    // Search database for each variation and combine results
    const resultSets = await Promise.all(
      queryVariations.map(variation => databaseService.searchInventory(variation))
    );

    // Flatten and deduplicate by model
    const seen = new Set<string>();
    const uniqueResults: any[] = [];

    for (const results of resultSets) {
      for (const item of results) {
        if (!seen.has(item.model)) {
          seen.add(item.model);
          uniqueResults.push(item);
        }
      }
    }

    return uniqueResults;
  }

  /**
   * Get all available inventory
   */
  async getAvailable(): Promise<any[]> {
    return await databaseService.getAvailableInventory();
  }

  /**
   * Get inventory by category
   */
  async getByCategory(category: string): Promise<any[]> {
    return await databaseService.getInventoryByCategory(category);
  }

  /**
   * Format a single item conversationally (not like a bullet list!)
   * This is the "One Smart Tool" approach - return everything in one shot
   */
  formatItemRich(item: InventoryItem, isFirstInList: boolean = false): string {
    const parts: string[] = [];

    // Start conversationally
    const prefix = isFirstInList ? "We've got the" : "We also have the";
    parts.push(`${prefix} ${item.model}`);

    // Price (most important to customers)
    parts.push(`at $${item.price_per_day} a day`);

    // Year and condition together
    if (item.year && item.condition) {
      parts.push(`- it's a ${item.year} model in ${item.condition.toLowerCase()} condition`);
    } else if (item.year) {
      parts.push(`- it's a ${item.year} model`);
    } else if (item.condition) {
      parts.push(`- ${item.condition.toLowerCase()} condition`);
    }

    // Add key specs naturally (extract most important detail)
    if (item.specs) {
      const specsLower = item.specs.toLowerCase();
      // Extract capacity/weight if available
      if (specsLower.includes('ton')) {
        const tonMatch = specsLower.match(/(\d+)-ton/);
        if (tonMatch) {
          parts.push(`with ${tonMatch[1]} tons capacity`);
        }
      } else if (specsLower.includes('hp')) {
        const hpMatch = specsLower.match(/(\d+)hp/);
        if (hpMatch) {
          parts.push(`with ${hpMatch[1]} horsepower`);
        }
      }
    }

    // Availability note (if multiple available)
    if (item.available > 1) {
      parts.push(`(we have ${item.available} of these)`);
    }

    return parts.join(' ');
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
   * Returns: count, price range, top picks, clarifying question
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

    // Summary line - conversational
    response.push(`Yeah, we've got ${count} ${query.toLowerCase()} in stock right now.`);
    response.push(`Prices run from $${minPrice} to $${maxPrice} a day.`);

    // Top picks - natural flow
    response.push(`Let me tell you about the top options.`);
    top3.forEach((item, idx) => {
      response.push(this.formatItemRich(item, idx === 0));
    });

    // Clarifying question - natural
    response.push(`What's most important for your job - size, price, or condition?`);

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
  async searchAndFormat(query: string): Promise<string> {
    const matches = await this.search(query);

    // TIER 1: No results
    if (matches.length === 0) {
      return `I checked the lot, but I don't see any ${query} available right now. Want me to connect you with someone to check other options or put you on a waitlist?`;
    }

    // Separate available vs unavailable items
    const available = matches.filter(m => m.available > 0);
    const unavailable = matches.filter(m => m.available === 0);

    // TIER 4: 6+ results -> Summary mode
    if (available.length >= 6) {
      return this.buildSummary(available, query);
    }

    // TIER 2 & 3: 1-5 results -> Full details, conversational style
    const response: string[] = [];

    if (available.length > 0) {
      // Smart sort even for small lists
      const sorted = this.smartSort(available, query);

      if (sorted.length === 1) {
        // Single item - direct and friendly
        const item = sorted[0];
        response.push(`Yeah, ${this.formatItemRich(item, true).replace("We've got the", "we've got the")}.`);
      } else if (sorted.length === 2) {
        // Two items - natural comparison
        response.push(this.formatItemRich(sorted[0], true) + '.');
        response.push(this.formatItemRich(sorted[1], false) + '.');
        response.push(`Which one sounds better for what you need?`);
      } else {
        // 3-5 items - conversational list
        response.push(`We've got ${sorted.length} options for you.`);
        sorted.forEach((item, idx) => {
          response.push(this.formatItemRich(item, idx === 0) + '.');
        });
        response.push(`Any of those catch your eye?`);
      }
    }

    // Mention unavailable items naturally
    if (unavailable.length > 0 && unavailable.length < 3) {
      unavailable.forEach(item => {
        response.push(`The ${item.model} is out right now, but normally goes for $${item.price_per_day} a day if you want to wait.`);
      });
    }

    return response.join(' ');
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
