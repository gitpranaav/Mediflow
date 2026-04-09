export function serializeDoc<T extends { _id?: { toString(): string } }>(doc: T | null) {
  if (!doc) return null;
  const { _id, ...rest } = doc as any;
  return { id: _id?.toString(), ...rest };
}

export function serializeDocs<T extends { _id?: { toString(): string } }>(docs: T[]) {
  return docs.map((doc) => serializeDoc(doc));
}
