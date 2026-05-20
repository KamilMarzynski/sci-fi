import type { CreateFeatureMetadataInput, FeatureMetadata } from "./types.js";
export {
  buildFeatureDirectoryPath,
  buildFeatureMetadataPath,
} from "./paths.js";

export function createInitialFeatureMetadata(
  input: CreateFeatureMetadataInput,
): FeatureMetadata {
  const { id, slug, title, createdAt } = input;

  return {
    version: 1,
    id,
    slug,
    ...(title !== undefined && { title }),
    status: "created",
    createdAt,
    updatedAt: createdAt,
  };
}
