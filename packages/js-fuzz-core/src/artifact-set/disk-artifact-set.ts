import { IArtifactSet, IArtifact, getArtifactId } from '.';
import {
  readdir,
  readFile,
  stat,
  pathExists,
  readJson,
  mkdirp,
  writeFile,
  writeJson,
} from 'fs-extra';
import { extname, join } from 'path';

export class DiskArtifactSet<T> implements IArtifactSet<T> {
  /**
   * Additional metadata file stored in the artifacts.
   */
  private static readonly metadataExtension = '.metadata';

  private data?: Promise<{ [id: string]: IArtifact<T> }>;

  constructor(private readonly directory: string) {}

  public async add(artifact: IArtifact<T>) {
    const id = getArtifactId(artifact);
    const todo: Promise<any>[] = [
      this.all().then(contents => (contents[id] = artifact)),
      writeFile(join(this.directory, id), artifact.data),
    ];

    if (artifact.metadata) {
      todo.push(
        writeJson(join(this.directory, id + DiskArtifactSet.metadataExtension), artifact.metadata),
      );
    }

    await Promise.all(todo);
  }

  public all() {
    if (!this.data) {
      this.data = this.loadFromDisk();
    }

    return this.data;
  }

  private async loadFromDisk() {
    const output: { [id: string]: IArtifact<T> } = {};

    await mkdirp(this.directory);

    for (const filename of await readdir(this.directory)) {
      const file = join(this.directory, filename);
      if (extname(file) === DiskArtifactSet.metadataExtension) {
        continue;
      }

      if (!(await stat(file)).isFile()) {
        continue;
      }

      const data = await readFile(file);
      const delimiter = data.indexOf(0);
      if (delimiter === -1) {
        continue;
      }

      const metadata = (await pathExists(file + DiskArtifactSet.metadataExtension))
        ? await readJson(file + DiskArtifactSet.metadataExtension)
        : null;
      const signature = getArtifactId(data.slice(delimiter + 1));

      output[signature] = { data, metadata, userGenerated: signature !== filename };
    }

    return output;
  }
}
