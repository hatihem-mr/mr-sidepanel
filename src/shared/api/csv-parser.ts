import Papa from 'papaparse';
import type { ParsedCSV } from '../types/index.js';
import { LIMITS } from '../constants.js';

/**
 * CSV Parser utility class
 */
export class CSVParser {
  /**
   * Parse CSV text with robust error handling
   */
  static async parseCSV(csvText: string): Promise<ParsedCSV> {
    return new Promise((resolve, reject) => {
      if (!csvText || !csvText.trim()) {
        reject(new Error('CSV text is empty'));
        return;
      }

      if (csvText.length > LIMITS.MAX_FILE_SIZE) {
        reject(new Error(`CSV too large. Maximum size is ${LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`));
        return;
      }

      Papa.parse(csvText, {
        header: false, // We'll handle headers manually for more control
        skipEmptyLines: true,
        dynamicTyping: false, // Keep everything as strings
        delimitersToGuess: [',', '\t', '|', ';'],
        complete: (results) => {
          try {
            const errors: string[] = [];
            
            // Collect parsing errors
            if (results.errors && results.errors.length > 0) {
              results.errors.forEach(error => {
                errors.push(`Row ${error.row}: ${error.message}`);
              });
            }

            const data = results.data as string[][];
            
            if (data.length === 0) {
              reject(new Error('No data found in CSV'));
              return;
            }

            // Clean up data - remove empty rows and trim cells
            const cleanedData = data
              .filter(row => row.some(cell => cell && cell.trim())) // Remove empty rows
              .map(row => row.map(cell => cell ? cell.trim() : '')); // Trim cells

            // Extract headers (assume first row)
            const headers = cleanedData.length > 0 ? cleanedData[0] : [];
            
            // Clean headers - remove whitespace and make unique
            const cleanedHeaders = headers.map((header, index) => {
              let cleaned = header.trim();
              if (!cleaned) {
                cleaned = `Column ${index + 1}`;
              }
              return cleaned;
            });

            const result: ParsedCSV = {
              data: cleanedData,
              headers: cleanedHeaders,
              rowCount: cleanedData.length,
              errors
            };

            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to process CSV: ${error.message}`));
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }

  /**
   * Extract text from CSV data intelligently
   */
  static extractTextFromCSV(data: string[][], options?: {
    skipHeader?: boolean;
    targetColumns?: string[];
    filterEmpty?: boolean;
  }): string[] {
    const opts = {
      skipHeader: true,
      filterEmpty: true,
      ...options
    };

    const results: string[] = [];
    const startIndex = opts.skipHeader ? 1 : 0;

    // If target columns specified, try to find them
    let targetColumnIndices: number[] = [];
    if (opts.targetColumns && data.length > 0) {
      const headers = data[0].map(h => h.toLowerCase().trim());
      targetColumnIndices = opts.targetColumns
        .map(col => headers.indexOf(col.toLowerCase().trim()))
        .filter(index => index !== -1);
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      
      if (targetColumnIndices.length > 0) {
        // Extract from specific columns
        targetColumnIndices.forEach(colIndex => {
          if (colIndex < row.length) {
            const cell = row[colIndex].trim();
            if (!opts.filterEmpty || cell.length > 0) {
              results.push(cell);
            }
          }
        });
      } else {
        // Extract from all columns
        row.forEach(cell => {
          const cleaned = cell.trim();
          if (!opts.filterEmpty || (cleaned.length > 2 && this.looksLikeValidTerm(cleaned))) {
            results.push(cleaned);
          }
        });
      }
    }

    return [...new Set(results)]; // Remove duplicates
  }

  /**
   * Detect column types in CSV data
   */
  static detectColumnTypes(data: string[][]): { [columnName: string]: string } {
    if (data.length < 2) return {};

    const headers = data[0];
    const columnTypes: { [columnName: string]: string } = {};

    headers.forEach((header, index) => {
      const columnData = data.slice(1, 11) // Sample first 10 rows
        .map(row => row[index])
        .filter(cell => cell && cell.trim());

      if (columnData.length === 0) {
        columnTypes[header] = 'empty';
        return;
      }

      // Check patterns
      const urlCount = columnData.filter(cell => /^https?:\/\//.test(cell)).length;
      const emailCount = columnData.filter(cell => /@.*\./.test(cell)).length;
      const domainCount = columnData.filter(cell => /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(cell)).length;
      const nameCount = columnData.filter(cell => /^[A-Z][a-z]+ [A-Z]/.test(cell)).length;

      if (urlCount / columnData.length > 0.7) {
        columnTypes[header] = 'url';
      } else if (emailCount / columnData.length > 0.7) {
        columnTypes[header] = 'email';
      } else if (domainCount / columnData.length > 0.5) {
        columnTypes[header] = 'domain';
      } else if (nameCount / columnData.length > 0.5) {
        columnTypes[header] = 'name';
      } else {
        columnTypes[header] = 'text';
      }
    });

    return columnTypes;
  }

  /**
   * Smart extraction based on detected content types
   */
  static smartExtractFromCSV(data: string[][]): {
    outlets: string[];
    contacts: string[];
    urls: string[];
    other: string[];
  } {
    const result = {
      outlets: [] as string[],
      contacts: [] as string[],
      urls: [] as string[],
      other: [] as string[]
    };

    if (data.length < 2) return result;

    const columnTypes = this.detectColumnTypes(data);
    const headers = data[0];

    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];

      row.forEach((cell, colIndex) => {
        const cleaned = cell.trim();
        if (!cleaned || cleaned.length < 3) return;

        const header = headers[colIndex];
        const columnType = columnTypes[header];

        switch (columnType) {
          case 'url':
          case 'domain':
            result.urls.push(cleaned);
            break;
          case 'email':
          case 'name':
            result.contacts.push(cleaned);
            break;
          default:
            // Try to categorize based on content
            if (/^https?:\/\//.test(cleaned) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(cleaned)) {
              result.urls.push(cleaned);
            } else if (/@.*\./.test(cleaned) || /^[A-Z][a-z]+ [A-Z]/.test(cleaned)) {
              result.contacts.push(cleaned);
            } else if (this.looksLikeOutlet(cleaned)) {
              result.outlets.push(cleaned);
            } else {
              result.other.push(cleaned);
            }
        }
      });
    }

    // Remove duplicates
    Object.keys(result).forEach(key => {
      result[key as keyof typeof result] = [...new Set(result[key as keyof typeof result])];
    });

    return result;
  }

  /**
   * Check if text looks like a valid search term
   */
  private static looksLikeValidTerm(text: string): boolean {
    if (text.length < 3) return false;
    
    // Skip if it's mostly numbers
    if (/^\d+$/.test(text)) return false;
    
    // Skip if it's just punctuation
    if (/^[^a-zA-Z0-9]+$/.test(text)) return false;
    
    return true;
  }

  /**
   * Check if text looks like an outlet name
   */
  private static looksLikeOutlet(text: string): boolean {
    // Check for common outlet patterns
    const outletPatterns = [
      /\b(news|times|post|herald|tribune|journal|gazette|chronicle|observer|reporter|press|daily|weekly|monthly|magazine|blog|media|network|tv|radio|channel)\b/i,
      /\b(the .+|.+ news|.+ times|.+ post)\b/i
    ];

    return outletPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Validate CSV file before processing
   */
  static validateCSVFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    if (file.size > LIMITS.MAX_FILE_SIZE) {
      errors.push(`File too large. Maximum size is ${LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check file type
    const validTypes = ['text/csv', 'application/csv', 'text/plain'];
    const validExtensions = ['.csv', '.txt'];
    
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidType && !hasValidExtension) {
      errors.push('Invalid file type. Please use CSV or TXT files.');
    }

    // Check for empty file
    if (file.size === 0) {
      errors.push('File is empty');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate CSV from data
   */
  static generateCSV(data: string[][], headers?: string[]): string {
    const csvData = headers ? [headers, ...data] : data;
    
    return Papa.unparse(csvData, {
      quotes: true,
      quoteChar: '"',
      delimiter: ',',
      header: false,
      newline: '\n'
    });
  }
}