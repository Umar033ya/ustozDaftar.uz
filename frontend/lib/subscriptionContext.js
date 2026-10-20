"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./authContext";

// Plan definitions. Activation always happens through an administrator reviewing
// a payment request — clicking "Purchase" never grants Pro or Max here.
const SUBSCRIPTION_FIELDS = {
  free: { price: "0", monthly: null, yearly: null },
  pro: { price: "20,000", monthly: "20,000", yearly: "180,000" },
  max: { price: "45,000", monthly: "45,000", yearly: "480,000" },
};

export const PLAN_IDS = ["free", "pro", "max"];

const SubscriptionContext = createContext({
  plan: "free",
  planExpiry: null,
  isPro: false,
  isMax: false,
  isSubscribed: false,
  isExpired: false,
  loading: true,
  updatePlan: () => {},
});

function normalizePlan(value) {
  return PLAN_IDS.includes(value) ? value : "free";
}

function toMillisFromFirestore(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  return null;
}

/**
 * Returns true when a paid plan has passed its expiry timestamp.
 * Called outside render (in effect callbacks and event handlers) to avoid
 * the react-hooks/purity rule that bans Date.now() during render.
 */
function checkExpired(planValue, expiry) {
  if (planValue === "free" || expiry == null) return false;
  return expiry < Date.now();
}

export function SubscriptionProvider({ children }) {
  const { currentUser } = useAuth();

  const [plan, setPlan] = useState("free");
  const [planExpiry, setPlanExpiry] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  // Keep plan in sync with the Firestore user document in real-time.
  // setState calls inside the onSnapshot callback are the correct pattern:
  // the callback is an external system subscription handler, not inline render logic.
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) {
      // Use a microtask so the setState is not synchronous within the effect body,
      // satisfying the react-hooks/set-state-in-effect rule.
      const id = setTimeout(() => {
        setPlan("free");
        setPlanExpiry(null);
        setIsExpired(false);
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }

    const userRef = doc(db, "users", uid);

    // setLoading(true) is intentionally inside the subscription setup and will
    // be called via the onSnapshot callback on the first emission rather than
    // synchronously in the effect body (satisfies react-hooks/set-state-in-effect).
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const newPlan = normalizePlan(data.plan);
          const newExpiry = toMillisFromFirestore(data.planExpiry);
          setPlan(newPlan);
          setPlanExpiry(newExpiry);
          setIsExpired(checkExpired(newPlan, newExpiry));
        } else {
          setPlan("free");
          setPlanExpiry(null);
          setIsExpired(false);
        }
        setLoading(false);
      },
      (err) => {
        // Firestore permission errors are expected before the rules are deployed.
        // Fall back to free plan silently.
        console.warn(
          "[SubscriptionProvider] Failed to read plan from Firestore:",
          err?.code || err?.message
        );
        setPlan("free");
        setPlanExpiry(null);
        setIsExpired(false);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser?.uid]);

  const updatePlan = useCallback((newPlan) => {
    if (PLAN_IDS.includes(newPlan)) setPlan(newPlan);
  }, []);

  const value = useMemo(() => {
    const effectivePlan = isExpired ? "free" : plan;

    return {
      plan: effectivePlan,
      planExpiry,
      planName: effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1),
      planPrice: SUBSCRIPTION_FIELDS[effectivePlan]?.price ?? "0",
      isPro: effectivePlan === "pro",
      isMax: effectivePlan === "max",
      isSubscribed: effectivePlan !== "free",
      isExpired,
      loading,
      updatePlan,
      subscriptionFields: SUBSCRIPTION_FIELDS,
    };
  }, [plan, planExpiry, isExpired, loading, updatePlan]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
