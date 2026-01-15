// ===================================================================
// ADMIN HTML PARSER
// ===================================================================
// Parses HTML from Muck Rack admin pages to extract user data.
// Handles both detailed user pages and search results pages.
// ===================================================================

import { debug } from '../../shared/utils/debug.js';

/**
 * Parse admin user HTML to extract comprehensive data fields
 * Based on the actual admin search results table structure
 *
 * @param html - HTML string from Muck Rack admin page
 * @param email - Optional email address for fallback validation
 * @returns Object containing extracted user data fields
 */
export function parseAdminUserHTML(html: string, email?: string): {
  status?: string;
  role?: string;
  organization?: string;
  package?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  customerId?: string;
  userType?: string;
  identifiesAs?: string;
  dateJoined?: string;
  lastLogin?: string;
  // Additional fields we're looking for
  orgRequirement?: string;
  twoFactor?: string;
  backupCodes?: string;
  authMethod?: string;
  phoneNumber?: string;
  resolvedAddresses?: string;
  senderIdentities?: string;
  externalAuth?: string;
  permissionOverrides?: string[];
} {
  try {

    // Check what type of page this is
    if (html.includes('Select user to change')) {
    } else if (html.includes('Change user')) {
    } else {
    }

    // Look for major sections

    // Look for specific readonly divs
    const readonlyMatches = html.match(/<div class="readonly"[^>]*>.*?<\/div>/g);
    if (readonlyMatches) {
      readonlyMatches.forEach((match, index) => {
      });
    } else {
    }

    // Look for fieldsets
    const fieldsetMatches = html.match(/<fieldset[^>]*>[\s\S]*?<h2>(.*?)<\/h2>[\s\S]*?<\/fieldset>/g);
    if (fieldsetMatches) {
      fieldsetMatches.forEach((match, index) => {
        const titleMatch = match.match(/<h2>(.*?)<\/h2>/);
        const title = titleMatch ? titleMatch[1] : 'Unknown';
      });
    } else {
    }

    const data: any = {};

    // Check if this is a detailed user page or search results
    if (html.includes('Change user')) {

      // FIRST: Extract basic user info from detailed page if available
      const usernameMatch = html.match(/<input[^>]*name="username"[^>]*value="([^"]+)"/);
      if (usernameMatch) {
        data.emailAddress = usernameMatch[1];
      }

      // Extract first/last name from breadcrumbs or page title
      const breadcrumbMatch = html.match(/Change user[\s\S]*?<h1[^>]*>([^<]+)</);
      if (breadcrumbMatch) {
        const fullName = breadcrumbMatch[1].trim();
        const nameParts = fullName.split(' ');
        if (nameParts.length >= 2) {
          data.firstName = nameParts[0];
          data.lastName = nameParts.slice(1).join(' ');
        }
      }

      // Extract status and role from Permissions fieldset in detailed page
      const permissionsFieldsetMatch = html.match(/<fieldset[^>]*>[\s\S]*?<h2>Permissions<\/h2>[\s\S]*?<\/fieldset>/);
      if (permissionsFieldsetMatch) {
        const permHtml = permissionsFieldsetMatch[0];

        // Active status
        const activeMatch = permHtml.match(/<input[^>]*name="is_active"[^>]*checked/);
        data.status = activeMatch ? 'active' : 'inactive';

        // Role
        const roleMatch = permHtml.match(/<label>Role:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
        if (roleMatch) {
          data.role = roleMatch[1].trim();
        }
      }

      // EXTRACT FROM DETAILED PAGE FIELDSETS

      // Authentication fieldset
      const authFieldsetMatch = html.match(/<fieldset[^>]*>[\s\S]*?<h2>Authentication<\/h2>[\s\S]*?<\/fieldset>/);
      if (authFieldsetMatch) {
        const authHtml = authFieldsetMatch[0];

        // Organization requirement
        const orgReqMatch = authHtml.match(/<label>Organization requirement:<\/label>[\s\S]*?<div class="readonly"><span>([^<]+)<\/span><\/div>/);
        if (orgReqMatch) {
          data.orgRequirement = orgReqMatch[1].trim();
        }

        // Two-Factor Authentication
        const twoFactorMatch = authHtml.match(/<label>Two-Factor Authentication:<\/label>[\s\S]*?<div class="readonly"><span>([^<]+)<\/span>/);
        if (twoFactorMatch) {
          data.twoFactor = twoFactorMatch[1].trim();
        }

        // Authentication method
        const authMethodMatch = authHtml.match(/<label>Authentication method:<\/label>[\s\S]*?<div class="readonly"><span>([^<]+)<\/span><\/div>/);
        if (authMethodMatch) {
          data.authMethod = authMethodMatch[1].trim();
        }

        // Phone number
        const phoneMatch = authHtml.match(/<label>Phone number:<\/label>[\s\S]*?<div class="readonly"><span>([^<]+)<\/span><\/div>/);
        if (phoneMatch) {
          data.phoneNumber = phoneMatch[1].trim();
        }

        // Backup codes
        const backupMatch = authHtml.match(/<label>Number of backup codes used:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
        if (backupMatch) {
          data.backupCodes = backupMatch[1].trim();
        }
      } else {
      }

      // Email Sending fieldset
      const emailFieldsetMatch = html.match(/<fieldset[^>]*>[\s\S]*?<h2>Email Sending<\/h2>[\s\S]*?<\/fieldset>/);
      if (emailFieldsetMatch) {
        const emailHtml = emailFieldsetMatch[0];

        // Resolved Addresses - try multiple patterns
        let resolvedMatch = emailHtml.match(/<label>Resolved Addresses:<\/label>[\s\S]*?<div class="form-row">(.*?)<br>/);
        if (!resolvedMatch) {
          // Try alternate pattern without <br>
          resolvedMatch = emailHtml.match(/<label>Resolved Addresses:<\/label>[\s\S]*?<div class="form-row">([^<]+)/);
        }
        if (!resolvedMatch) {
          // Try readonly div pattern
          resolvedMatch = emailHtml.match(/<label>Resolved Addresses:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
        }
        if (resolvedMatch) {
          data.resolvedAddresses = resolvedMatch[1].trim();
        } else {
        }

        // External authorization - try multiple patterns
        let externalMatch = emailHtml.match(/<label>External authorization:<\/label>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
        if (!externalMatch) {
          // Try pattern without link
          externalMatch = emailHtml.match(/<label>External authorization:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
        }
        if (!externalMatch) {
          // Try simple text pattern
          externalMatch = emailHtml.match(/<label>External authorization:<\/label>[\s\S]*?<span>([^<]+)<\/span>/);
        }
        if (externalMatch) {
          data.externalAuth = externalMatch[1].trim();
        } else {
        }

        // Add Sender Identities parsing (might be missing)
        let senderMatch = emailHtml.match(/<label>Sender Identities:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
        if (!senderMatch) {
          senderMatch = emailHtml.match(/<label>Sender Identities:<\/label>[\s\S]*?<span>([^<]+)<\/span>/);
        }
        if (!senderMatch) {
          senderMatch = emailHtml.match(/<label>Sender Identities:<\/label>[\s\S]*?<div class="form-row">([^<]+)/);
        }
        if (senderMatch) {
          data.senderIdentities = senderMatch[1].trim();
        } else {
        }
      } else {
      }

      // Profile fieldset
      const profileFieldsetMatch = html.match(/<fieldset[^>]*>[\s\S]*?<h2>Profile<\/h2>[\s\S]*?<\/fieldset>/);
      if (profileFieldsetMatch) {
        const profileHtml = profileFieldsetMatch[0];

        // Organization
        const orgMatch = profileHtml.match(/<strong><a[^>]*>([^<]+)<\/a><\/strong>/);
        if (orgMatch) {
          data.organization = orgMatch[1].trim();
        }

        // Package
        const packageMatch = profileHtml.match(/<label>Package:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
        if (packageMatch) {
          data.package = packageMatch[1].trim();
        }
      } else {
      }

      // User permission overrides
      const permissionTableMatch = html.match(/<h2>User permission overrides<\/h2>[\s\S]*?<table>[\s\S]*?<\/table>/);
      if (permissionTableMatch) {
        const permissionHtml = permissionTableMatch[0];

        // Extract selected permissions
        const permissionMatches = permissionHtml.match(/<option[^>]*selected[^>]*>([^<]+)<\/option>/g);
        if (permissionMatches) {
          data.permissionOverrides = permissionMatches.map(match => {
            const textMatch = match.match(/>([^<]+)</);
            return textMatch ? textMatch[1] : '';
          }).filter(Boolean);
        }
      } else {
      }

    } else if (html.includes('Select user to change')) {

    // This is a search results page with a table structure
    // Look for the actual data row in the table (the row that contains the user data)
    // Pattern: <tr><td class="action-checkbox">...<th class="field-email">...email@example.com...</th><td class="field-first_name">Name</td>...

    const tableRowPattern = /<tr[^>]*>.*?<th class="field-email">.*?<\/th>.*?<td class="field-first_name">.*?<\/tr>/s;
    const tableRowMatch = html.match(tableRowPattern);

    if (tableRowMatch) {
      const rowHTML = tableRowMatch[0];

      // Extract email from the <th class="field-email"> element
      const emailMatch = rowHTML.match(/<th class="field-email"[^>]*>.*?>([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})<\/a><\/th>/);
      if (emailMatch) {
        data.emailAddress = emailMatch[1];
      }

      // Extract first name from <td class="field-first_name">
      const firstNameMatch = rowHTML.match(/<td class="field-first_name"[^>]*>([^<]+)<\/td>/);
      if (firstNameMatch) {
        data.firstName = firstNameMatch[1].trim();
      }

      // Extract last name from <td class="field-last_name">
      const lastNameMatch = rowHTML.match(/<td class="field-last_name"[^>]*>([^<]+)<\/td>/);
      if (lastNameMatch) {
        data.lastName = lastNameMatch[1].trim();
      }

      // Extract package from <td class="field-package">
      const packageMatch = rowHTML.match(/<td class="field-package"[^>]*>([^<]+)<\/td>/);
      if (packageMatch) {
        data.package = packageMatch[1].trim();
      }

      // Extract organization from <td class="field-organization"> (contains a link)
      const organizationMatch = rowHTML.match(/<td class="field-organization"[^>]*><a[^>]*>([^<]+)<\/a><\/td>/);
      if (organizationMatch) {
        data.organization = organizationMatch[1].trim();
      }

      // Extract customer ID from <td class="field-customer_id">
      const customerIdMatch = rowHTML.match(/<td class="field-customer_id"[^>]*>([^<]+)<\/td>/);
      if (customerIdMatch) {
        data.customerId = customerIdMatch[1].trim();
      }

      // Extract role from <td class="field-role">
      const roleMatch = rowHTML.match(/<td class="field-role"[^>]*>([^<]+)<\/td>/);
      if (roleMatch) {
        data.role = roleMatch[1].trim();
      }

      // Extract user type from <td class="field-user_type">
      const userTypeMatch = rowHTML.match(/<td class="field-user_type"[^>]*>([^<]+)<\/td>/);
      if (userTypeMatch) {
        data.userType = userTypeMatch[1].trim();
      }

      // Extract status from <td class="field-teammember_status">
      const statusMatch = rowHTML.match(/<td class="field-teammember_status"[^>]*>([^<]+)<\/td>/);
      if (statusMatch) {
        data.status = statusMatch[1].trim();
      }

      // Extract identifies as from <td class="field-identifies_as">
      const identifiesAsMatch = rowHTML.match(/<td class="field-identifies_as"[^>]*>([^<]+)<\/td>/);
      if (identifiesAsMatch) {
        data.identifiesAs = identifiesAsMatch[1].trim();
      }

      // Extract date joined from <td class="field-date_joined nowrap">
      const dateJoinedMatch = rowHTML.match(/<td class="field-date_joined[^"]*"[^>]*>([^<]+)<\/td>/);
      if (dateJoinedMatch) {
        data.dateJoined = dateJoinedMatch[1].trim();
      }

      // Extract last login from <td class="field-last_login nowrap">
      const lastLoginMatch = rowHTML.match(/<td class="field-last_login[^"]*"[^>]*>([^<]+)<\/td>/);
      if (lastLoginMatch) {
        data.lastLogin = lastLoginMatch[1].trim();
      }

    } else {

      // Fallback: try to find any email directly to ensure we're looking at the right data
      const simpleEmailMatch = email ? html.match(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')) : null;
      if (simpleEmailMatch) {

        // Try alternate extraction patterns based on what we can see
        const alternateEmailMatch = html.match(/<a[^>]*href="\/mradmin\/auth\/user\/\d+\/change\/[^"]*">([^<]+@[^<]+)<\/a>/);
        if (alternateEmailMatch) {
          data.emailAddress = alternateEmailMatch[1];
        }
      } else {
      }
    }
    } else {
    }


    return data;

  } catch (error) {
    debug.error('🔥 Error parsing admin HTML:', error);
    return {};
  }
}
