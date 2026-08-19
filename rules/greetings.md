# Greetings Banner Component

This document outlines the design, content structure, and operational rules for the Dashboard Greetings Banner used in the NGConnect dashboard.

## 1. Component Location & Overview

- **Component File**: [`src/components/dashboard-greeting.tsx`](file:///d:/Projects/NGConnect/src/components/dashboard-greeting.tsx)
- **Data File**: [`src/components/greetings-data.ts`](file:///d:/Projects/NGConnect/src/components/greetings-data.ts)
- **Purpose**: Displays a personalized, context-aware greeting to the user based on the current time of day. It is designed to be highly aesthetic, visually engaging, and welcoming. Content and logic are strictly separated.

## 2. Component Design & Aesthetics

The component heavily utilizes Tailwind CSS for styling and interactive micro-animations to achieve a premium feel:

- **Layout**: A flexible, rounded card layout with a text section on the left and an icon container on the right.
- **Dynamic Styling**: 
  - Background gradients (`bg-gradient-to-br`).
  - Themed borders.
  - Accent text colors.
  - A decorative colored glow backdrop.
- **Animations (Micro-interactions)**:
  - Base transition (`transition-all duration-700`).
  - Card hover scale (`hover:scale-[1.005]`) and enhanced shadow (`hover:shadow-md`).
- **Icons**: Sourced from `lucide-react`, rendered with specific colors and sometimes animations (e.g., `animate-pulse`, `animate-bounce-slow`).
- **Accessibility**: Includes proper ARIA attributes (`role="region"`, `aria-live="polite"`, `aria-label="Dashboard greeting"`) and hides the loading skeleton from screen readers (`aria-hidden="true"`).

## 3. Content Structure

The greeting data is kept separate from the component logic in `greetings-data.ts`:

- **`hourlyGreetings`**: A `Record<number, GreetingEntry[]>` containing exactly 120 greetings.
- **Mapping**: The dictionary maps the 24 hours of a day (0 through 23) to an array of exactly 5 unique greetings.
- **`GreetingEntry` Type**:
  - `text`: A template string (e.g., `"Hello, {name}!"`). `{name}` is dynamically replaced with the user's first name.
  - `subtext`: A template string for the subtext, also supporting `{name}` replacement.
  - `icon`: A `LucideIcon` reference.
  - `iconClass`: Tailwind classes for icon styling and animations.
  - `gradient`: Tailwind classes for the specific gradient.
  - `border`: Tailwind classes for the specific border color.
  - `accentText`: Tailwind classes for the specific text color.

## 4. Operational Rules & Logic

The `DashboardGreeting` component operates under the following rules:

### 4.1. Hydration & Safe Mounting
- Uses a `mounted` state flag and `useEffect` to ensure client-side rendering of the time-dependent content.
- Renders a fallback skeleton layout (`animate-pulse`) before mounting to strictly prevent hydration mismatches between the server and client.

### 4.2. User Personalization
- Retrieves the user's full name from `useUserContext()`.
- Extracts the first name by splitting the full name by space (`name.split(" ")[0]`).
- Falls back to `"Friend"` if the user data is unavailable.
- Performs a string replacement on `text` and `subtext`, replacing `{name}` with the extracted first name.

### 4.3. Time & Date Logic
- **Current Hour**: Uses `now.getHours()` to determine which array of 5 greetings to select from `hourlyGreetings`.
- **Live Updates**: A `setInterval` re-checks the clock every minute (`60_000` ms) so the greeting actively rolls over across hour boundaries without requiring a page refresh.
- **Cycle Calculation (`dailyVariantIndex`)**: Instead of relying on the day of the month (which causes repeating patterns on the 1st/6th/11th/etc.), the variant index relies on the **day of the year**. Since the offset varies month by month, the pattern only truly repeats once a year.

### 4.4. Safe Access & Fallbacks
- Uses fallback access with nullish coalescing (`??`) in case an hour or index is somehow missing:
  - `const hourData = hourlyGreetings[currentHour] ?? hourlyGreetings[12]`
  - `return hourData[variantIndex] ?? hourData[0]`

## 5. Preview Environment
- A dedicated page exists at [`src/app/(dashboard)/greetings/page.tsx`](file:///d:/Projects/NGConnect/src/app/(dashboard)/greetings/page.tsx) to preview all 120 variations, complete with search functionality and a grid layout to view the gradients, icons, and text for every hour of the day.
