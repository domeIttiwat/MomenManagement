# Project Blueprint

## Overview

This application is an internal management system designed to streamline operations related to customers, orders, products, services, and assembly workflows. It provides a centralized platform for staff to manage day-to-day tasks efficiently.

## Features Implemented

### 1. Core Navigation & Layout
- A persistent sidebar for navigation between different sections of the application (Dashboard, Customers, Orders, Products, etc.).
- A main content area that displays the component for the currently selected route.
- Responsive design for use on various screen sizes.

### 2. Customer Management
- **View:** A list of all customers with search and sort functionalities.
- **Details:** A detailed view for each customer showing their information, contact channels, and purchase history.
- **Create/Edit:** Forms for adding new customers or updating existing ones.
- **Image Uploads:** Ability to upload customer-related images.

### 3. Order Management
- **View:** A list of all orders, filterable by status.
- **Details:** A detailed view for each order, including products, customer information, and payment status.
- **Create/Edit:** A comprehensive form for creating new orders, selecting customers and products.

### 4. Product Management
- **View:** A grid/list of all products with search and category filters.
- **Details:** A detailed view showing product variants, accessories, and components.
- **Create/Edit:** Forms to manage product information, including pricing, categories, and inventory.

### 5. Assembly Queue Management
- **Purpose:** Provides a dedicated interface to manage the queue of products that need to be assembled.
- **Data Source:** Displays items from orders that have the status "ส่งประกอบ" (Send to Assembly).
- **UI Components:**
    - A main list view showing all items in the assembly queue.
    - Each list item displays key information: Product Name, Order ID, Quantity, and Due Date.
    - A search bar to filter items by product name or order ID.
    - Sorting options to organize the queue by due date or product name.
- **Styling:** The design is consistent with other modules, using a clean layout, modern icons (`lucide-react`), and responsive design principles.

## Current Plan: Implement Assembly Queue UI

### Goal
Create the user interface for the "Assembly Queue" section, which will display a list of products waiting to be assembled.

### Action Steps

1.  **✅ Create `AssemblyMain.js` Component:**
    -   Generate a new file at `src/app/components/assembly/AssemblyMain.js`.
    -   Implement the main layout including a title, search bar, and sorting dropdown.
    -   Use `useState`, `useEffect`, and `useMemo` to handle state, data fetching (mocked for now), filtering, and sorting.
    -   Ensure the design is consistent with `CustomerMain.js` and `OrderMain.js`.

2.  **✅ Create `AssemblyListItem.js` Component:**
    -   Generate a new file at `src/app/components/assembly/AssemblyListItem.js`.
    -   Design a card-based component to display information for a single assembly item: product name, order ID, quantity, due date, and status.
    -   Style the component for clarity and visual appeal, consistent with the application's design system.

3.  **✅ Update `assembly/page.js`:**
    -   Ensure `src/app/assembly/page.js` correctly imports and renders the `AssemblyMain` component. (This file already exists and is correctly set up).

4.  **✅ Update `blueprint.md`:**
    -   Create this `blueprint.md` file.
    -   Document the existing high-level features of the application.
    -   Add a detailed section for the newly implemented "Assembly Queue Management" feature.
    -   Outline the plan and action steps for the current task.
