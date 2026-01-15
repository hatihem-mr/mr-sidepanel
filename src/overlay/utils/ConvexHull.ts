import { debug } from '../../shared/utils/debug.js';
// ===================================================================
// CONVEX HULL UTILITIES - Geometric Calculations for Overlay Positioning
// ===================================================================
// Modernized convex hull calculations for determining if points are
// within complex shapes formed by multiple elements or text ranges.
// ===================================================================

/**
 * Represents a 2D point with x and y coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Cross product of vectors OA and OB where O is the origin
 * Returns positive if OAB is counter-clockwise, negative if clockwise, zero if collinear
 */
function crossProduct(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/**
 * Computes the convex hull of a set of 2D points using Graham scan algorithm
 * Time complexity: O(n log n)
 * 
 * @param points Array of points to compute convex hull for
 * @returns Array of points forming the convex hull in counter-clockwise order
 */
export function computeConvexHull(points: Point[]): Point[] {
  if (points.length < 3) {
    return points; // Convex hull of less than 3 points is the points themselves
  }

  // Create a copy and sort points lexicographically (first by x, then by y)
  const sortedPoints = [...points].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  // Build lower hull
  const lower: Point[] = [];
  for (const point of sortedPoints) {
    // Remove points from lower hull while the last 3 points make a clockwise turn
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  // Build upper hull
  const upper: Point[] = [];
  for (let i = sortedPoints.length - 1; i >= 0; i--) {
    const point = sortedPoints[i];
    // Remove points from upper hull while the last 3 points make a clockwise turn
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  // Remove the last point of each half because they are repeated
  lower.pop();
  upper.pop();

  // Concatenate lower and upper hull
  return lower.concat(upper);
}

/**
 * Determines if a point is inside a convex polygon using cross product method
 * Assumes the polygon vertices are in counter-clockwise order
 * 
 * @param point The point to test
 * @param polygon Array of points forming the convex polygon
 * @returns true if point is inside the polygon, false otherwise
 */
export function isPointInConvexPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    return false; // Not a valid polygon
  }

  // For a convex polygon in counter-clockwise order, the point is inside
  // if it's to the left of all edges (cross product > 0)
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    
    // If cross product is negative, point is to the right of this edge (outside)
    if (crossProduct(current, next, point) < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Main function to check if a point is within the convex hull of given points
 * This is the primary function used by the overlay system
 * 
 * @param point The point to test
 * @param hullPoints Array of points that define the convex hull
 * @returns true if point is inside the convex hull, false otherwise
 */
export function isInConvexHull(point: Point, hullPoints: Point[]): boolean {
  if (hullPoints.length < 3) {
    return false;
  }

  try {
    const hull = computeConvexHull(hullPoints);
    return isPointInConvexPolygon(point, hull);
  } catch (error) {
    debug.warn('Error computing convex hull:', error);
    return false;
  }
}

/**
 * Converts a DOMRect to an array of corner points
 * Useful for converting element bounding boxes to convex hull points
 */
export function rectToPoints(rect: DOMRect): Point[] {
  return [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
}

/**
 * Gets points from multiple DOM elements and combines them
 * Useful for creating convex hulls around multiple elements
 */
export function getPointsFromElements(elements: Element[]): Point[] {
  const points: Point[] = [];
  
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) { // Only include visible elements
      points.push(...rectToPoints(rect));
    }
  }
  
  return points;
}

/**
 * Calculates the area of a convex polygon
 * Can be used to determine the size of the convex hull
 */
export function calculatePolygonArea(polygon: Point[]): number {
  if (polygon.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) / 2;
}

/**
 * Finds the centroid (center point) of a convex polygon
 * Useful for positioning overlays relative to the center of complex shapes
 */
export function calculatePolygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) {
    return { x: 0, y: 0 };
  }

  if (polygon.length === 1) {
    return polygon[0];
  }

  let centroidX = 0;
  let centroidY = 0;
  let area = 0;

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const crossProduct = current.x * next.y - next.x * current.y;
    
    area += crossProduct;
    centroidX += (current.x + next.x) * crossProduct;
    centroidY += (current.y + next.y) * crossProduct;
  }

  area /= 2;
  
  if (area === 0) {
    // Fallback to simple average if area is zero (degenerate polygon)
    return {
      x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
      y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
    };
  }

  return {
    x: centroidX / (6 * area),
    y: centroidY / (6 * area),
  };
}

/**
 * Expands a convex hull by a given margin
 * Useful for creating hover areas larger than the actual elements
 */
export function expandConvexHull(hull: Point[], margin: number): Point[] {
  if (hull.length < 3 || margin <= 0) {
    return hull;
  }

  const centroid = calculatePolygonCentroid(hull);
  
  return hull.map(point => {
    // Calculate direction vector from centroid to point
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    
    // Calculate distance from centroid to point
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      return point; // Point is at centroid, can't expand
    }
    
    // Normalize direction vector and expand by margin
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    return {
      x: point.x + normalizedDx * margin,
      y: point.y + normalizedDy * margin,
    };
  });
}

/**
 * Debug utility to visualize a convex hull on the page
 * Only used in development/debugging
 */
export function debugDrawConvexHull(
  hull: Point[], 
  color: string = '#ff0000', 
  strokeWidth: number = 2
): HTMLElement | null {
  if (typeof document === 'undefined' || hull.length < 3) {
    return null;
  }

  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'fixed';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100vw';
  svg.style.height = '100vh';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '999999';

  // Create polygon element
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  const points = hull.map(p => `${p.x},${p.y}`).join(' ');
  polygon.setAttribute('points', points);
  polygon.setAttribute('fill', 'transparent');
  polygon.setAttribute('stroke', color);
  polygon.setAttribute('stroke-width', strokeWidth.toString());

  svg.appendChild(polygon);
  document.body.appendChild(svg);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (svg.parentNode) {
      svg.parentNode.removeChild(svg);
    }
  }, 5000);

  return svg;
}