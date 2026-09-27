"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getUserProfile, updateUserProfile } from "./firestoreService";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function register(email, password, firstName, lastName) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create profile doc in Firestore
    const profileData = {
      firstName,
      lastName,
      email,
      schoolName: "",
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "users", user.uid), profileData, { merge: true });
    } catch (e) {
      // Profile could not be stored (e.g. rules not deployed): do not leave a
      // half-registered session behind, the user must be able to retry.
      await signOut(auth).catch(() => {});
      setUserProfile(null);
      const error = new Error("PROFILE_CREATE_FAILED");
      error.cause = e;
      throw error;
    }

    setUserProfile(profileData);
    return user;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
    setUserProfile(null);
  }

  const refreshProfile = async () => {
    if (auth.currentUser) {
      try {
        const profile = await getUserProfile(auth.currentUser.uid);
        if (profile) {
          setUserProfile(profile);
        }
      } catch (e) {
        console.error("Failed to refresh profile:", e);
      }
    }
  };

  /** First/last name live in Firestore only - Firebase Auth has no such fields. */
  async function updateProfileNames(firstName, lastName) {
    const user = auth.currentUser;
    if (!user) throw new Error("NO_USER");
    await updateUserProfile(user.uid, { firstName, lastName });
    await refreshProfile();
  }

  /**
   * Firebase requires a recent sign-in before sensitive changes. The caller passes the
   * user's current password, which is used for the re-authentication and never stored
   * (not in Firestore, not in localStorage).
   */
  async function reauthenticate(currentPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("NO_USER");
    if (!user.email) throw new Error("NO_EMAIL_FOR_REAUTH");
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword)
    );
  }

  /**
   * Change the sign-in email. This project enforces verified email changes, so a direct
   * `updateEmail` is rejected with auth/operation-not-allowed - the new address has to be
   * confirmed by the user first. `verifyBeforeUpdateEmail` sends that link; the Auth email
   * only changes once it is clicked, so the Firestore copy is left untouched until then
   * (onAuthStateChanged reconciles it). Projects without the enforcement fall back to
   * `updateEmail`, which applies the change immediately.
   *
   * @returns {Promise<{ email: string, pendingVerification: boolean }>}
   */
  async function changeEmail(newEmail) {
    const user = auth.currentUser;
    if (!user) throw new Error("NO_USER");

    let pendingVerification = false;
    try {
      await verifyBeforeUpdateEmail(user, newEmail);
      pendingVerification = true;
    } catch (e) {
      if (e?.code !== "auth/operation-not-allowed") throw e;
      await updateEmail(user, newEmail);
    }

    if (pendingVerification) {
      return { email: newEmail, pendingVerification: true };
    }

    // Auth is the source of truth here; the Firestore copy is synchronized afterwards.
    try {
      await updateUserProfile(user.uid, { email: user.email });
    } catch (e) {
      console.error("Email updated in Auth but the Firestore profile sync failed:", e);
      const error = new Error("PROFILE_EMAIL_SYNC_FAILED");
      error.cause = e;
      throw error;
    }

    await refreshProfile();
    return { email: user.email, pendingVerification: false };
  }

  async function changePassword(newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("NO_USER");
    await updatePassword(user, newPassword);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          let profile = await getUserProfile(user.uid);
          // A verified email change only lands once the user clicks the link, usually in
          // another session, so reconcile the profile copy here instead of leaving it stale.
          if (profile && user.email && profile.email !== user.email) {
            try {
              await updateUserProfile(user.uid, { email: user.email });
              profile = { ...profile, email: user.email };
            } catch (e) {
              console.error("Failed to sync the profile email:", e);
            }
          }
          setUserProfile(profile);
        } catch (e) {
          console.error("Failed to load user profile", e);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        register,
        login,
        logout,
        refreshProfile,
        updateProfileNames,
        reauthenticate,
        changeEmail,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
