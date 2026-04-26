import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

export const PARTS_INDEX = 'spare_parts';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private esAvailable = false;

  constructor(private readonly esService: ElasticsearchService) {}

  async onModuleInit() {
    try {
      await this.ensureIndex();
      this.esAvailable = true;
      this.logger.log('Elasticsearch connection established');
    } catch (err) {
      this.logger.warn(
        `Elasticsearch not available: ${(err as any).message}. Search will fall back to MongoDB.`,
      );
      this.esAvailable = false;
    }
  }

  isAvailable() {
    return this.esAvailable;
  }

  // ================================================================
  // INDEX MANAGEMENT
  // ================================================================

  async ensureIndex() {
    const exists = await this.esService.indices.exists({ index: PARTS_INDEX });
    if (!exists) {
      await this.esService.indices.create({
        index: PARTS_INDEX,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              autocomplete_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'autocomplete_filter'],
              } as any,
              search_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase'],
              } as any,
            },
            filter: {
              autocomplete_filter: {
                type: 'edge_ngram',
                min_gram: 1,
                max_gram: 20,
              } as any,
            },
          },
        } as any,
        mappings: {
          properties: {
            _mongoId: { type: 'keyword' },
            sku: { type: 'keyword' },
            name: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'search_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'search_as_you_type' },
              },
            } as any,
            description: { type: 'text' },
            partCategory: { type: 'keyword' },
            applianceTypeSlug: { type: 'keyword' },
            applianceTypeName: { type: 'keyword' },
            brandSlug: { type: 'keyword' },
            brandName: { type: 'keyword' },
            partNumber: { type: 'keyword' },
            tags: { type: 'text', analyzer: 'autocomplete_analyzer' } as any,
            searchKeywords: { type: 'text', analyzer: 'autocomplete_analyzer' } as any,
            price: { type: 'integer' },
            mrp: { type: 'integer' },
            isUniversal: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            isActive: { type: 'boolean' },
            isInStock: { type: 'boolean' },
          },
        },
      });
      this.logger.log(`Created Elasticsearch index: ${PARTS_INDEX}`);
    }
  }

  // ================================================================
  // INDEXING
  // ================================================================

  async indexPart(part: any) {
    if (!this.esAvailable) return;
    try {
      await this.esService.index({
        index: PARTS_INDEX,
        id: part._id?.toString() || part.sku,
        document: this.mapPartToDoc(part),
      });
    } catch (err) {
      this.logger.warn(`Failed to index part ${part.sku}: ${(err as any).message}`);
    }
  }

  async bulkIndex(parts: any[]) {
    if (!this.esAvailable || !parts.length) return { indexed: 0, errors: 0 };

    const operations = parts.flatMap((part) => [
      { index: { _index: PARTS_INDEX, _id: part._id?.toString() || part.sku } },
      this.mapPartToDoc(part),
    ]);

    const result = await this.esService.bulk({ operations, refresh: true });
    const errors = (result.items || []).filter((i: any) => i.index?.error);
    this.logger.log(
      `Bulk indexed ${parts.length - errors.length} parts, ${errors.length} errors`,
    );
    return { indexed: parts.length - errors.length, errors: errors.length };
  }

  async deleteFromIndex(mongoId: string) {
    if (!this.esAvailable) return;
    try {
      await this.esService.delete({ index: PARTS_INDEX, id: mongoId });
    } catch (_) {}
  }

  private mapPartToDoc(part: any) {
    return {
      _mongoId: part._id?.toString(),
      sku: part.sku,
      name: part.name,
      description: part.description || '',
      partCategory: part.partCategory || '',
      applianceTypeSlug: part.applianceTypeSlug || '',
      applianceTypeName: part.applianceTypeName || part.applianceTypeSlug || '',
      brandSlug: part.brandSlug || '',
      brandName: part.brandName || part.brandSlug || '',
      partNumber: part.partNumber || '',
      tags: (part.tags || []).join(' '),
      searchKeywords: (part.searchKeywords || []).join(' '),
      price: part.price || 0,
      mrp: part.mrp || 0,
      isUniversal: part.isUniversal || false,
      isFeatured: part.isFeatured || false,
      isActive: part.isActive !== false,
      isInStock: part.isInStock !== false,
    };
  }

  // ================================================================
  // SUGGEST
  // ================================================================

  async suggest(q: string): Promise<{
    parts: any[];
    categories: any[];
    brands: any[];
  }> {
    if (!this.esAvailable || !q) return { parts: [], categories: [], brands: [] };

    try {
      // Fetch part hits
      const hitsResponse = await this.esService.search({
        index: PARTS_INDEX,
        size: 6,
        _source: ['sku', 'name', 'partNumber', 'price', 'applianceTypeSlug', 'brandSlug', 'partCategory', '_mongoId'],
        query: {
          bool: {
            must: [{ term: { isActive: true } }],
            should: [
              { match_phrase_prefix: { name: { query: q, boost: 5 } as any } },
              {
                multi_match: {
                  query: q,
                  type: 'bool_prefix',
                  fields: ['name.suggest', 'name.suggest._2gram', 'name.suggest._3gram'],
                  boost: 3,
                } as any,
              },
              {
                multi_match: {
                  query: q,
                  fields: ['partNumber', 'sku', 'tags', 'searchKeywords', 'partCategory', 'brandSlug'],
                  fuzziness: 'AUTO',
                } as any,
              },
            ] as any,
            minimum_should_match: 1,
          },
        } as any,
        sort: [{ _score: { order: 'desc' } }, { isFeatured: { order: 'desc' } }] as any,
      });

      // Aggregation for categories + brands
      const aggResponse = await this.esService.search({
        index: PARTS_INDEX,
        size: 0,
        query: {
          bool: {
            must: [{ term: { isActive: true } }],
            should: [
              { match_phrase_prefix: { name: { query: q } as any } },
              { multi_match: { query: q, fields: ['partCategory', 'brandSlug', 'brandName', 'tags'] } as any },
            ] as any,
            minimum_should_match: 1,
          },
        } as any,
        aggs: {
          categories: { terms: { field: 'partCategory', size: 4 },
            aggs: { appliance: { terms: { field: 'applianceTypeSlug', size: 1 } } },
          },
          brands: { terms: { field: 'brandSlug', size: 3 } },
        } as any,
      });

      const parts = (hitsResponse.hits?.hits || []).map((hit: any) => ({
        type: 'part',
        title: hit._source.name,
        subtitle: hit._source.partNumber
          ? `PN: ${hit._source.partNumber}`
          : hit._source.partCategory,
        sku: hit._source.sku,
        mongoId: hit._source._mongoId,
        price: hit._source.price,
        appliance: hit._source.applianceTypeSlug,
        brand: hit._source.brandSlug,
      }));

      const aggs: any = aggResponse.aggregations;
      const categories = (aggs?.categories?.buckets || []).map((b: any) => ({
        type: 'category',
        title: b.key,
        subtitle: `Browse ${b.appliance?.buckets?.[0]?.key || ''} spare parts`,
        slug: (b.key as string)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        appliance: b.appliance?.buckets?.[0]?.key || '',
        count: b.doc_count,
      }));

      const brands = (aggs?.brands?.buckets || []).map((b: any) => ({
        type: 'brand',
        title: b.key,
        subtitle: 'Shop by brand',
        slug: b.key,
        count: b.doc_count,
      }));

      return { parts, categories, brands };
    } catch (err) {
      this.logger.warn(`Search suggest error: ${(err as any).message}`);
      return { parts: [], categories: [], brands: [] };
    }
  }

  // ================================================================
  // FULL SEARCH (used by main listing if needed)
  // ================================================================

  async fullSearch(
    q: string,
    filters: {
      applianceType?: string;
      brand?: string;
      partCategory?: string;
      isUniversal?: boolean;
      isFeatured?: boolean;
      page?: number;
      limit?: number;
      sort?: string;
    } = {},
  ) {
    if (!this.esAvailable) return null;

    const { page = 1, limit = 24, sort, ...rest } = filters;
    const from = (page - 1) * limit;

    const mustClauses: any[] = [{ term: { isActive: true } }];
    if (rest.applianceType) mustClauses.push({ term: { applianceTypeSlug: rest.applianceType } });
    if (rest.brand) mustClauses.push({ term: { brandSlug: rest.brand } });
    if (rest.partCategory) mustClauses.push({ term: { partCategory: rest.partCategory } });
    if (rest.isUniversal !== undefined) mustClauses.push({ term: { isUniversal: rest.isUniversal } });
    if (rest.isFeatured !== undefined) mustClauses.push({ term: { isFeatured: rest.isFeatured } });

    const shouldClauses: any[] = q
      ? [
          { match_phrase_prefix: { name: { query: q, boost: 5 } } },
          { multi_match: { query: q, type: 'bool_prefix', fields: ['name.suggest', 'name.suggest._2gram'], boost: 3 } },
          { multi_match: { query: q, fields: ['partNumber', 'sku', 'tags', 'searchKeywords', 'brandSlug', 'partCategory'], fuzziness: 'AUTO' } },
        ]
      : [];

    const sortClause: any[] =
      sort === 'price_asc' ? [{ price: 'asc' }]
        : sort === 'price_desc' ? [{ price: 'desc' }]
        : sort === 'popular' ? [{ isFeatured: 'desc' }, { _score: 'desc' }]
        : q ? [{ _score: 'desc' }, { isFeatured: 'desc' }]
        : [{ isFeatured: 'desc' }];

    try {
      const response = await this.esService.search({
        index: PARTS_INDEX,
        from,
        size: limit,
        query: {
          bool: {
            must: mustClauses,
            should: shouldClauses,
            minimum_should_match: shouldClauses.length > 0 ? 1 : 0,
          },
        } as any,
        sort: sortClause,
      });

      return {
        hits: (response.hits?.hits || []).map((h: any) => h._source),
        total: (response.hits?.total as any)?.value || 0,
      };
    } catch (err) {
      this.logger.warn(`Full search error: ${(err as any).message}`);
      return null;
    }
  }
}
