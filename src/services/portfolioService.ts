import { 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  description?: string;
  createdAt?: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Robust and secure Firestore error handling as per security guidelines.
 * Packages error context into a structured JSON string, facilitating precise diagnostic feedback.
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Secure Access Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Secure Service API Wrapper to fetch Pamnim Interiors portfolio items from Firebase Firestore.
 */
export const PortfolioService = {
  /**
   * Fetches published portfolio items ordered by newest creation date securely.
   */
  async getPortfolioItems(): Promise<PortfolioItem[]> {
    const path = 'portfolio';
    try {
      const portfolioRef = collection(db, path);
      const portfolioQuery = query(portfolioRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(portfolioQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PortfolioItem[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  /**
   * Real-time subscription to portfolio updates with robust permission-error interception.
   */
  subscribeToPortfolio(onUpdate: (items: PortfolioItem[]) => void, onError?: (err: Error) => void): () => void {
    const path = 'portfolio';
    const portfolioRef = collection(db, path);
    const portfolioQuery = query(portfolioRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      portfolioQuery,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PortfolioItem[];
        onUpdate(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (wrappedError: any) {
          if (onError) {
            onError(wrappedError);
          } else {
            console.error(wrappedError);
          }
        }
      }
    );

    return unsubscribe;
  }
};
