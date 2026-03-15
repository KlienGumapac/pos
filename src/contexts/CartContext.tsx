"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface PhoneIdentifier {
  imei: string;
  serialNumber: string;
}

export interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  total: number;
  stock: number;
  images?: string[];
  phoneIdentifiers?: PhoneIdentifier[];
  selectedPhoneIdentifiers?: PhoneIdentifier[];
}

interface CartContextType {
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  updateCartItemPhoneSelection: (itemId: string, selected: PhoneIdentifier[]) => void;
  hasItems: boolean;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cashier-cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        setCart([]);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cashier-cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1, total: (cartItem.quantity + 1) * cartItem.price }
            : cartItem
        );
      } else {
        return [...prevCart, { ...item, quantity: 1, total: item.price }];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item => {
        if (item.id !== itemId) return item;
        const next = { ...item, quantity, total: quantity * item.price };
        if (next.selectedPhoneIdentifiers && next.selectedPhoneIdentifiers.length > quantity) {
          next.selectedPhoneIdentifiers = next.selectedPhoneIdentifiers.slice(0, quantity);
        }
        return next;
      })
    );
  };

  const updateCartItemPhoneSelection = (itemId: string, selected: PhoneIdentifier[]) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === itemId ? { ...item, selectedPhoneIdentifiers: selected } : item
      )
    );
  };

  const hasItems = cart.length > 0;
  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart,
      setCart,
      addToCart,
      removeFromCart,
      clearCart,
      updateCartQuantity,
      updateCartItemPhoneSelection,
      hasItems,
      cartTotal,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
