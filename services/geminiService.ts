import { AttendanceRecord } from '../types';
import { COMPANY_API_URL } from '../constants';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transcribes audio to extract an Employee ID using Gemini Flash.
 */
export const transcribeEmployeeId = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: "Listen to the audio clearly. Extract the alphanumeric Employee ID (e.g., C282811). Return ONLY the ID string. Do not include any other text, punctuation, or markdown."
          }
        ]
      }
    });
    return response.text ? response.text.trim().replace(/\s/g, '').toUpperCase() : "";
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
};

/**
 * Extracts Employee ID from an image (Barcode or Text) using Gemini.
 */
export const extractIdFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: "Analyze this image for an Employee ID. It is usually an alphanumeric code (e.g., starting with A, B, C, D followed by numbers, like C282811 or A123456) or encoded in a Barcode/QR Code. \n\nIf you find a valid Employee ID, return ONLY the ID string (e.g. 'C282811'). \nIf you cannot find any valid ID, return exactly the string 'NOT_FOUND'. \nDo NOT return sentences like 'I cannot find...'."
          }
        ]
      }
    });
    
    let result = response.text ? response.text.trim().toUpperCase() : "";
    
    // Cleanup any markdown or extra spaces
    result = result.replace(/['"`]/g, '').replace(/\s/g, '');

    if (result === 'NOT_FOUND' || result.length > 15 || result.length < 3) {
        return ""; // Treat as not found
    }

    return result;
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    throw error;
  }
};

/**
 * Fetches REAL Attendance Data from Company Website via Proxy.
 * Returns actual data or throws error. NO MOCK DATA.
 */
export const fetchAttendanceData = async (empId: string): Promise<AttendanceRecord[]> => {
  // Try Primary Proxy
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`${COMPANY_API_URL}?emp_no=${empId}`)}`;
    const records = await fetchAndParse(proxyUrl);
    return records;
  } catch (primaryError) {
    console.warn("Primary proxy failed, trying backup...", primaryError);
    
    // Try Backup Proxy (AllOrigins)
    try {
      const backupProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${COMPANY_API_URL}?emp_no=${empId}`)}`;
      const records = await fetchAndParse(backupProxyUrl);
      return records;
    } catch (backupError) {
      console.error("All proxies failed.", backupError);
      throw new Error("Failed to connect to Company Server. Please check your internet connection.");
    }
  }
};

// Helper function to fetch and parse HTML table
async function fetchAndParse(url: string): Promise<AttendanceRecord[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const htmlContent = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const rows = Array.from(doc.querySelectorAll('table tr'));
        const records: AttendanceRecord[] = [];
        
        // Check if we actually got a table
        if (rows.length === 0) {
             // Check for specific error text on the page if possible, e.g. "No data found"
             if (htmlContent.includes("No data") || htmlContent.length < 500) { // Basic check
                 return []; // Return empty array if page loaded but no table
             }
             // If HTML is weird but no table, might be blocking or captcha
             throw new Error("Invalid response structure from server.");
        }

        // Parsing table (Skip header row 0)
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length >= 4) {
            const dateTimeStr = cells[3].textContent?.trim() || "";
            if (dateTimeStr) {
                records.push({
                  id: i,
                  empNo: cells[1].textContent?.trim() || "",
                  name: cells[2].textContent?.trim() || "Unknown",
                  dateTime: dateTimeStr
                });
            }
          }
        }

        return records;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}