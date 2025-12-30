// src/services/inventory.service.ts
import { INVENTORY } from '../db/mock';
import { InventoryItem } from '../types';

export class InventoryService {
  /**
   * Search inventory by query string
   * Matches against model name and category
   */
  search(query: string): InventoryItem[] {
    if (!query) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();

    return INVENTORY.filter(item =>
      item.model.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery)
    );
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
   * Format inventory results as human-readable string
   */
  formatResults(items: InventoryItem[]): string {
    if (items.length === 0) {
      return "";
    }

    return items.map(item =>
      `${item.model} (${item.available} available at $${item.price_per_day}/day)`
    ).join(", ");
  }

  /**
   * Search and format results for tool response
   */
  searchAndFormat(query: string): string {
    const matches = this.search(query);

    if (matches.length > 0) {
      const formattedList = this.formatResults(matches);
      return `We have the following available: ${formattedList}`;
    }

    return `I checked the lot, but I don't see any ${query} available right now.`;
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
