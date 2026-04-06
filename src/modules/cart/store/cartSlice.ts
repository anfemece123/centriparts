import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  name: string
  reference: string | null
  price: number        // unit price snapshot at time of add
  imageUrl: string | null
  quantity: number
}

export interface CartState {
  items: CartItem[]
  isOpen: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage persistence helpers
// Keys and read/write are isolated here so the slice stays pure.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'centriparts_cart'

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CartItem[]
  } catch {
    return []
  }
}

function saveToStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage unavailable (private mode quota, etc.) — fail silently
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state — items are hydrated from localStorage on first load
// ─────────────────────────────────────────────────────────────────────────────

const initialState: CartState = {
  items: loadFromStorage(),
  isOpen: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Add a product to the cart.
     * If the product is already in the cart, its quantity is increased by the
     * incoming quantity (default 1). Price is always taken from the payload so
     * it reflects the current catalog price at the moment of adding.
     */
    addItem(state, action: PayloadAction<Omit<CartItem, 'quantity'> & { quantity?: number }>) {
      const { quantity = 1, ...incoming } = action.payload
      const existing = state.items.find((i) => i.productId === incoming.productId)

      if (existing) {
        existing.quantity += quantity
      } else {
        state.items.push({ ...incoming, quantity })
      }

      saveToStorage(state.items)
    },

    /**
     * Remove a product from the cart entirely, regardless of quantity.
     */
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.productId !== action.payload)
      saveToStorage(state.items)
    },

    /**
     * Set the quantity of a specific item.
     * - quantity < 1 → removes the item from the cart.
     * - quantity ≥ 1 → updates the item in place.
     */
    updateQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const { productId, quantity } = action.payload

      if (quantity < 1) {
        state.items = state.items.filter((i) => i.productId !== productId)
      } else {
        const item = state.items.find((i) => i.productId === productId)
        if (item) item.quantity = quantity
      }

      saveToStorage(state.items)
    },

    /**
     * Remove all items from the cart and clear localStorage.
     * Called after a successful order submission.
     */
    clearCart(state) {
      state.items = []
      saveToStorage(state.items)
    },

    /** Open the cart drawer. */
    openCart(state) {
      state.isOpen = true
    },

    /** Close the cart drawer. */
    closeCart(state) {
      state.isOpen = false
    },
  },
})

export const {
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
  openCart,
  closeCart,
} = cartSlice.actions

export default cartSlice.reducer
