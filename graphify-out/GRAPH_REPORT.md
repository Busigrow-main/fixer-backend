# Graph Report - fixer-backend  (2026-11-26)

## Corpus Check
- 342 files · ~184,475 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 5, .example 3, .conf 1)

## Summary
- 3454 nodes · 9387 edges · 161 communities (94 shown, 67 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 490 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9d2483c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AdminController
- AuthController
- appliance.schema.ts
- bookings.service.ts
- BookingDocument
- @nestjs/mongoose
- @nestjs/mongoose
- ShopPartHelpController
- package.json
- BookingsService
- OpsQueueService
- TechniciansService
- home-data.integration.spec.ts
- TechnicianEngineService
- FeedbackService
- technician-schedule.ts
- technician-auth.service.ts
- leads.service.ts
- mongoose
- technician-engine.ts
- TechnicianPartRequestsService
- TechnicianPlatformAdminController
- class-validator
- @nestjs/swagger
- admin.controller.ts
- performance-summary.service.ts
- CustomerAppliancesService
- CurrentTechnician
- dependencies
- SettlementsService
- elasticsearch
- TechnicianOnboardingService
- .update
- settlement.ts
- CheckoutService
- JobCompletionService
- ShopProductType
- GstBreakdownDto
- TechnicianAuthService
- JobSheetService
- build-shop-api-docx.py
- scripts
- PartOrdersService
- technician-platform.module.ts
- elasticsearch
- compilerOptions
- shop.module.ts
- steps
- upload-to-cloudinary.ts
- seed-appliances.ts
- fixxer-release.sh
- verify-images.ts
- CartController
- InstallationController
- SparePartsController
- technician-onboarding.controller.ts
- gst.engine.ts
- PerformanceSummaryController
- steps
- scripts/seed-appliances.js
- seed-5000-parts.js
- customer-booking.helpers.ts
- CreatePartOrderDto
- cart.service.ts
- CartService
- merge-and-seed.ts
- shop.spec.ts
- scrape-product-images.ts
- WishlistController
- OnboardingAnalyticsService
- NotificationsController
- ServiceablePincodesService
- dotenv
- seed-spare-parts-v2.js
- UsersService
- PartOrdersController
- .update
- seed-spare-parts.js
- bill-email.service.ts
- paths.ts
- EarningsController
- wishlist.controller.ts
- AuthService
- BookingsController
- seed.js
- ref_mongodb
- TechnicianDashboardController
- TechnicianVerificationService
- VisitsController
- seed-performance-test-data.ts
- part-order.schema.ts
- SparePartsService
- AddCartItemDto
- TechnicianSparePartsController
- app.controller.ts
- fixxer-code.ts
- job-sheet-defaults.ts
- part-orders.service.ts
- SearchService
- AdminOffersController
- jest
- booking.schema.ts
- UpdateOrderBillDto
- auth.controller.ts
- fix-spare-part-unit-prices.js
- CustomerAppliancesService
- eslint.config.mjs
- @nestjs/schedule
- .getDashboardStats
- ShopPartHelpQueryDto
- cart.schema.ts
- booking-change-history.ts
- GstService
- nest-cli.json
- search.module.ts
- seed-services.js
- seed-appliances.js
- ServicesService
- bookings.controller.ts
- image-urls.ts
- seed-admin.js
- CreateShopPartHelpDto
- UpdateOpsSettingsDto
- ShopPartHelpService
- fixxer-autodeploy.sh
- seed-allowed-pincodes.ts
- backup-mongo.sh
- deploy.sh
- install-autodeploy.sh
- seed-fresh.sh
- setup-ec2.sh
- JobCompletionService
- UpdateOpsPendingWorkDto
- TokenService
- OffersService
- OpsController
- QuoteShopPartHelpDto
- .findOne
- OffersController
- seed-settlement-test-data.ts
- jwt.strategy.ts
- main.ts
- visits.service.spec.ts
- OpsSettingsDocument
- assertValidCalendarDate

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 155 edges
2. `@nestjs/mongoose` - 135 edges
3. `mongoose` - 132 edges
4. `BookingsService` - 84 edges
5. `CurrentTechnician` - 62 edges
6. `AdminController` - 57 edges
7. `BookingDocument` - 55 edges
8. `Booking` - 52 edges
9. `TechniciansService` - 52 edges
10. `@nestjs/swagger` - 51 edges

## Surprising Connections (you probably didn't know these)
- `computeInvoiceTotals()` --calls--> `breakdownInvoice()`  [EXTRACTED]
  src/part-orders/part-orders.service.ts → src/gst/gst.engine.ts
- `AdminController` --references--> `Roles()`  [EXTRACTED]
  src/admin/admin.controller.ts → src/auth/decorators/roles.decorator.ts
- `toSlot()` --calls--> `assertValidSlot()`  [EXTRACTED]
  src/admin/admin.controller.ts → src/technician-engine/technician-schedule.ts
- `presentCompletionBooking()` --calls--> `omitTechnicianForbiddenBookingFields()`  [EXTRACTED]
  src/technician-platform/job-completion/job-completion.service.ts → src/bookings/booking-change-history.ts
- `presentCompletionBooking()` --calls--> `stripFixxerCodeSecrets()`  [EXTRACTED]
  src/technician-platform/job-completion/job-completion.service.ts → src/bookings/fixxer-code.ts

## Import Cycles
- None detected.

## Communities (161 total, 67 thin omitted)

### Community 0 - "AdminController"
Cohesion: 0.07
Nodes (6): AdminController, csv, excelCellValue(), parseServiceDay(), toSlot(), CustomerServiceHistoryService

### Community 2 - "appliance.schema.ts"
Cohesion: 0.07
Nodes (24): APPLIANCE_CATEGORIES, APPLIANCE_TYPE_ALIASES, ApplianceCategory, assertApplianceCategory(), resolveApplianceCategory(), AppliancesController, AppliancesService, ApplianceResponseDto (+16 more)

### Community 3 - "bookings.service.ts"
Cohesion: 0.09
Nodes (27): mongodb-memory-server, @nestjs/testing, AssignSlotInput, SLOT_END_MINUTES, Booking, BookingSchema, CustomerAppliancesModule, MapApplianceInput (+19 more)

### Community 4 - "BookingDocument"
Cohesion: 0.09
Nodes (15): BookingDocument, SparePart, SparePartDocument, resolveTechnicianId(), technicianIdQuery(), JobSheetSaveBody, PartInventoryTransactionDocument, SparePartUsage (+7 more)

### Community 5 - "@nestjs/mongoose"
Cohesion: 0.08
Nodes (22): @nestjs/mongoose, AuthModule, OpsModule, NEXT_ACTION, OpsOverdueRow, OpsPendingReason, REASON_PRIORITY, OpsSettingsService (+14 more)

### Community 6 - "@nestjs/mongoose"
Cohesion: 0.10
Nodes (23): mongoose, BRANDS, buildAppliances(), buildParts(), CATEGORIES, seed(), TYPES, ApplianceType (+15 more)

### Community 8 - "package.json"
Cohesion: 0.04
Nodes (61): author, description, devDependencies, dotenv@^17.4.2, eslint@^9.18.0, eslint-config-prettier@^10.0.1, @eslint/eslintrc@^3.2.0, jest@^30.0.0 (+53 more)

### Community 9 - "BookingsService"
Cohesion: 0.09
Nodes (10): BookingAuditContext, BookingChangeEventInput, BookingsService, getServiceNow(), isTechOccupyingStatus(), assertNotInPast(), isFixxerStaff(), SlotCheck (+2 more)

### Community 10 - "OpsQueueService"
Cohesion: 0.20
Nodes (4): OpsQueueScheduler, formatAge(), OpsQueueService, OpsThresholds

### Community 11 - "TechniciansService"
Cohesion: 0.06
Nodes (5): activeJobQuery(), RejectApplicationDto, TechniciansController, build(), TechniciansService

### Community 12 - "home-data.integration.spec.ts"
Cohesion: 0.18
Nodes (10): OffersModule, OfferInput, Offer, OFFER_AUDIENCES, OFFER_THEMES, OfferAudience, OfferDocument, OfferSchema (+2 more)

### Community 13 - "TechnicianEngineService"
Cohesion: 0.10
Nodes (9): availabilityForJobEvent(), isPreArrivalJobEvent(), TechnicianEngineService, toHttp(), AvailabilityStatus, buildJobsService(), buildService(), presentTechnicianBooking() (+1 more)

### Community 14 - "FeedbackService"
Cohesion: 0.05
Nodes (5): FeedbackFollowUpQueryDto, SubmitFeedbackDto, UpdateFeedbackFollowUpDto, FeedbackController, FeedbackService

### Community 15 - "technician-schedule.ts"
Cohesion: 0.08
Nodes (34): BookingSlotShiftScheduler, liveJobQuery(), TERMINAL_BOOKING_STATUSES, assertValidSlot(), cascade(), describeSlotClash(), formatServiceTime(), freeSlots() (+26 more)

### Community 16 - "technician-auth.service.ts"
Cohesion: 0.13
Nodes (8): bcrypt, @nestjs/jwt, EmailOtpService, EmailOtpSession, EmailOtpSessionDocument, EmailOtpSessionSchema, AuthTokens, isDuplicateKey()

### Community 17 - "leads.service.ts"
Cohesion: 0.06
Nodes (16): CreateLeadDto, LeadsController, LeadsModule, LeadsService, Lead, LeadDocument, LeadSchema, LeadStatus (+8 more)

### Community 18 - "mongoose"
Cohesion: 0.08
Nodes (21): AdminModule, CustomerAppliance, CustomerApplianceDocument, CustomerApplianceSchema, FeedbackModule, FEEDBACK_ELIGIBLE_STATUSES, FeedbackFollowUp, FeedbackFollowUpDocument (+13 more)

### Community 19 - "technician-engine.ts"
Cohesion: 0.10
Nodes (30): assertAssignableTechnician(), assertAssignmentAccepted(), assertAvailabilityStatus(), assertBookingAssignable(), assertBookingStatusTransition(), assertCanAcceptAssignment(), assertCanClaimJob(), assertCanEditJobSheet() (+22 more)

### Community 20 - "TechnicianPartRequestsService"
Cohesion: 0.06
Nodes (10): TechnicianPartRequestsController, CreateTechnicianPartRequestDto, TechnicianPartRequestListQueryDto, TechnicianPartRequestOperationDto, TechnicianPartRequestReasonDto, TechnicianPartRequestReturnDto, AdminPartRequestsController, TECHNICIAN_PART_REQUEST_STATUSES (+2 more)

### Community 22 - "class-validator"
Cohesion: 0.15
Nodes (3): class-transformer, class-validator, FEEDBACK_FOLLOW_UP_STATUSES

### Community 23 - "@nestjs/swagger"
Cohesion: 0.20
Nodes (11): @nestjs/common, @nestjs/core, @nestjs/passport, @nestjs/swagger, Roles(), ROLES_KEY, RolesGuard, JWT_AUTH (+3 more)

### Community 24 - "admin.controller.ts"
Cohesion: 0.10
Nodes (31): ActiveBodyDto, ArrivalDto, AssignTechnicianDto, AvailabilityDto, BookingIdDto, BookingSlotDto, BookingStatusDto, FixxerCodeDto (+23 more)

### Community 25 - "performance-summary.service.ts"
Cohesion: 0.06
Nodes (57): supertest, JOB_PAYOUT_TYPES, PerformanceSummaryModule, ACTIVE_BOOKING_STATUSES, DateWindow, PerformanceSummaryGenerationStatus, COMPLETED, FAILED (+49 more)

### Community 28 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, axios@^1.16.1, @azure/communication-email@^1.1.0, bcrypt@^6.0.0, class-transformer@^0.5.1, class-validator@^0.15.1, cloudinary@^2.10.0, csv-parser@^3.2.0 (+29 more)

### Community 29 - "SettlementsService"
Cohesion: 0.08
Nodes (9): SettlementsController, AddSettlementAdjustmentDto, MarkSettlementPayableDto, PrepareSettlementsDto, ReconcileSettlementDto, RecordSettlementPaymentDto, RejectSettlementDto, isDuplicateKeyError() (+1 more)

### Community 30 - "elasticsearch"
Cohesion: 0.07
Nodes (32): container_name, environment, healthcheck, image, logging, ports, profiles, restart (+24 more)

### Community 31 - "TechnicianOnboardingService"
Cohesion: 0.09
Nodes (5): paymentWebhookSecret(), webhookSecretMatches(), OnboardingProgressHelper, TechnicianOnboardingController, TechnicianOnboardingService

### Community 33 - "settlement.ts"
Cohesion: 0.12
Nodes (27): adapt(), rootParentId(), usagesForBooking(), idStr(), isOidHex(), isPaidBooking(), isWarrantyClaim(), originalCoveredAt() (+19 more)

### Community 34 - "CheckoutService"
Cohesion: 0.08
Nodes (5): CheckoutController, CheckoutService, CheckoutQuoteDto, CreateCheckoutDto, InstallationOptionsQueryDto

### Community 36 - "ShopProductType"
Cohesion: 0.16
Nodes (7): InstallationService, ShopWishlist, ShopWishlistDocument, ShopWishlistItem, ShopWishlistItemSchema, ShopProductType, WishlistService

### Community 37 - "GstBreakdownDto"
Cohesion: 0.26
Nodes (3): GstBreakdownDto, GstExtractDto, GstLineDto

### Community 38 - "TechnicianAuthService"
Cohesion: 0.12
Nodes (3): TechnicianAuthController, TechnicianAuthService, OtpService

### Community 40 - "build-shop-api-docx.py"
Cohesion: 0.16
Nodes (18): add_bottom_border(), add_code_block(), add_footer(), add_html_table(), add_method_heading(), add_rich_paragraph(), walk(), configure_styles() (+10 more)

### Community 41 - "scripts"
Cohesion: 0.07
Nodes (27): scripts, ac:merge, ac:pipeline, ac:scrape, ac:seed, ac:upload, ac:verify, build (+19 more)

### Community 42 - "PartOrdersService"
Cohesion: 0.15
Nodes (5): ApplianceDocument, isShopOrderCancellable(), PartOrdersService, PartOrder, PartOrderDocument

### Community 43 - "technician-platform.module.ts"
Cohesion: 0.05
Nodes (26): BookingsModule, TechnicianEngineModule, OnboardingStatusResponse, AllowedPincode, AllowedPincodeDocument, AllowedPincodeSchema, Notification, NotificationDocument (+18 more)

### Community 44 - "elasticsearch"
Cohesion: 0.09
Nodes (25): container_name, driver, environment, healthcheck, image, ports, volumes, interval (+17 more)

### Community 45 - "compilerOptions"
Cohesion: 0.08
Nodes (24): exclude, extends, compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop (+16 more)

### Community 46 - "shop.module.ts"
Cohesion: 0.09
Nodes (9): SHOP_SETTINGS_KEY, ShopSettings, ShopSettingsDocument, ShopSettingsSchema, ShopWishlistSchema, ShopController, ShopMaintenanceGuard, ShopService (+1 more)

### Community 47 - "steps"
Cohesion: 0.09
Nodes (22): env, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, NEXT_PUBLIC_API_URL (+14 more)

### Community 48 - "upload-to-cloudinary.ts"
Cohesion: 0.17
Nodes (18): SEED_JSON, buildSkuIndex(), loadSeedProducts(), slugForSku(), AcStockType, AcStockUploadFile, AcStockUploadItem, CloudinaryManifest (+10 more)

### Community 49 - "seed-appliances.ts"
Cohesion: 0.15
Nodes (22): applyPricing(), buildDescriptionSections(), buildTechnicalDescription(), coolingBtu(), DATA_JSON, DescriptionSection, DescriptionSectionType, loadProducts() (+14 more)

### Community 50 - "fixxer-release.sh"
Cohesion: 0.22
Nodes (21): build_release(), current_release(), data_services(), deploy_app(), die(), HEALTH, health_check(), list_app() (+13 more)

### Community 51 - "verify-images.ts"
Cohesion: 0.14
Nodes (18): fileSha256(), ImageDimensions, ImageValidationOptions, ImageValidationResult, readDimensionsFromBuffer(), readImageDimensions(), validateImageFile(), DEFAULT_MIN_GALLERY_BYTES (+10 more)

### Community 55 - "technician-onboarding.controller.ts"
Cohesion: 0.18
Nodes (6): JobCompletionBodyDto, MapSerialDto, OnboardingCallDto, OnboardingEventDto, ReturnInventoryPartDto, UploadVerificationDocumentDto

### Community 56 - "gst.engine.ts"
Cohesion: 0.27
Nodes (16): applyExclusiveTax(), breakdownInvoice(), breakdownLine(), extractInclusiveTax(), roundMoney(), splitTaxComponents(), FIXXER_AC_SERVICE_SAC, FIXXER_SERVICE_GST_PERCENT (+8 more)

### Community 57 - "PerformanceSummaryController"
Cohesion: 0.08
Nodes (8): PerformanceSummaryController, PerformanceSummaryQueryDto, businessDateFromInstant(), isDuplicateKeyError(), parseBusinessDate(), PerformanceSummaryService, previousBusinessDate(), windowForBusinessDate()

### Community 58 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, jobs, build (+11 more)

### Community 59 - "scripts/seed-appliances.js"
Cohesion: 0.20
Nodes (15): buildDescription(), envPath, fs, buildHighlights(), buildProduct(), calcPrice(), main(), parseTon() (+7 more)

### Community 60 - "seed-5000-parts.js"
Cohesion: 0.14
Nodes (19): APPLIANCE_TYPES, BRANDS, COMMON_PART_CATEGORIES, generateDescription(), generateName(), generatePartNumber(), generatePrice(), generateSKU() (+11 more)

### Community 61 - "customer-booking.helpers.ts"
Cohesion: 0.15
Nodes (14): AWAITING_ASSIGNMENT, buildCustomerPricingSummary(), CUSTOMER_STATUS_STEPS, CustomerPricingSummary, CustomerStatusTone, CustomerStatusView, getCustomerStatusView(), pickUpcomingVisitSchedule() (+6 more)

### Community 62 - "CreatePartOrderDto"
Cohesion: 0.13
Nodes (6): plainText(), sanitizeContact(), ApplianceOrderItemDto, ContactDataDto, CreatePartOrderDto, OrderItemDto

### Community 63 - "cart.service.ts"
Cohesion: 0.18
Nodes (14): InstallationOption, applianceToShopCard(), applyDiscount(), DELIVERY_CHARGE_RUPEES, discountPercent(), formatBrand(), INSTALLATION_CHARGES, money() (+6 more)

### Community 64 - "CartService"
Cohesion: 0.24
Nodes (3): cartLineId(), CartService, ShopCartDocument

### Community 66 - "merge-and-seed.ts"
Cohesion: 0.22
Nodes (14): getArg(), getArgNumber(), parseArgs(), applyImagesToSections(), main(), mergeManifestIntoSeed(), runSeed(), SECTION_TYPES_WITH_IMAGE (+6 more)

### Community 67 - "shop.spec.ts"
Cohesion: 0.08
Nodes (23): AppliancesModule, Appliance, ApplianceSchema, DESCRIPTION_SECTION_TYPES, DescriptionFeature, DescriptionSection, DescriptionSectionType, DimensionSpec (+15 more)

### Community 68 - "scrape-product-images.ts"
Cohesion: 0.20
Nodes (18): downloadImage(), extFromUrl(), IMAGE_EXT, isImageFile(), listImageFiles(), normalizeImageUrl(), sleep(), skuImageDir() (+10 more)

### Community 72 - "ServiceablePincodesService"
Cohesion: 0.11
Nodes (6): CreateServiceablePincodeDto, UpdateServiceablePincodeDto, ServiceablePincode, ServiceablePincodeDocument, ServiceablePincodeSchema, ServiceablePincodesService

### Community 73 - "dotenv"
Cohesion: 0.22
Nodes (3): serviceablePincodes, dotenv, NON_OCCUPYING

### Community 74 - "seed-spare-parts-v2.js"
Cohesion: 0.12
Nodes (17): ApplianceType, applianceTypes, ApplianceTypeSchema, Brand, brands, BrandSchema, CategoryTree, CategoryTreeSchema (+9 more)

### Community 75 - "UsersService"
Cohesion: 0.15
Nodes (3): AdminService, UserDocument, UsersService

### Community 77 - ".update"
Cohesion: 0.12
Nodes (3): buildProfile(), TechnicianProfileController, TechnicianProfileService

### Community 78 - "seed-spare-parts.js"
Cohesion: 0.12
Nodes (15): ApplianceType, applianceTypes, ApplianceTypeSchema, Brand, BrandSchema, brandsData, CategoryTree, CategoryTreeSchema (+7 more)

### Community 79 - "bill-email.service.ts"
Cohesion: 0.05
Nodes (36): RFC-2047, AzureEmailService, buildMimeMessage(), EmailAttachment, EmailMessage, EmailService, encodeAddress(), encodeHeader() (+28 more)

### Community 80 - "paths.ts"
Cohesion: 0.18
Nodes (16): ENV_PATH, IMAGES_ROOT, MANIFEST_JSON, PIPELINE_ROOT, STOCK_UPLOAD_JSON, VERIFY_REPORT_JSON, filterBySku(), loadStockUpload() (+8 more)

### Community 82 - "wishlist.controller.ts"
Cohesion: 0.16
Nodes (5): AddWishlistItemDto, SoftWishlistSnapshotDto, SyncWishlistDto, WishlistItemIdParams, WishlistItemRefDto

### Community 85 - "seed.js"
Cohesion: 0.17
Nodes (14): exceljs@^4.4.0, exceljs, cleanAndTransformRow(), COLUMN_MAP, defaultFilePath, excelCellValue(), ExcelJS, fs (+6 more)

### Community 86 - "ref_mongodb"
Cohesion: 0.12
Nodes (11): client, main(), { MongoClient }, windowForBusinessDate(), client, main(), { MongoClient }, windowForBusinessDate() (+3 more)

### Community 90 - "seed-performance-test-data.ts"
Cohesion: 0.14
Nodes (17): BookingDoc, EarningDoc, EXPECTED_REPORT, ExpectedMetrics, FeedbackDoc, generateDayData(), main(), randEl() (+9 more)

### Community 91 - "part-order.schema.ts"
Cohesion: 0.26
Nodes (10): ApplianceOrderItem, ApplianceOrderItemSchema, BillLineItem, BillLineItemSchema, InvoiceSoldBy, InvoiceSoldBySchema, OrderInvoiceData, OrderInvoiceDataSchema (+2 more)

### Community 93 - "AddCartItemDto"
Cohesion: 0.27
Nodes (3): AddCartItemDto, ApplyCouponDto, UpdateCartItemDto

### Community 96 - "fixxer-code.ts"
Cohesion: 0.29
Nodes (9): sealCode(), assertFixxerCodeConfigured(), decryptFixxerCode(), encryptionKey(), FixxerCodeFields, fixxerCodeKey(), fixxerCodesMatch(), issueFixxerCode() (+1 more)

### Community 97 - "job-sheet-defaults.ts"
Cohesion: 0.27
Nodes (9): addMonths(), blank(), buildJobSheetDefaults(), formatDate(), isGeneratedWarrantyDesc(), JobSheetPart, partLabel(), partsFromVisits() (+1 more)

### Community 98 - "part-orders.service.ts"
Cohesion: 0.18
Nodes (9): computeInvoiceTotals(), CreatePartOrderOptions, CUSTOMER_CANCELLABLE, isShopInvoicePosted(), SHOP_PART_HELP_STATUSES, ShopPartHelpRequest, ShopPartHelpRequestDocument, ShopPartHelpRequestSchema (+1 more)

### Community 102 - "jest"
Cohesion: 0.22
Nodes (9): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+1 more)

### Community 103 - "booking.schema.ts"
Cohesion: 0.14
Nodes (22): AdditionalCharge, AdditionalChargeSchema, AddressData, AddressDataSchema, BOOKING_CHANGE_ACTOR_ROLES, BookingChangeHistoryEntry, BookingChangeHistoryEntrySchema, GpsLocation (+14 more)

### Community 104 - "UpdateOrderBillDto"
Cohesion: 0.24
Nodes (3): BillLineItemDto, InvoiceSoldByDto, UpdateOrderBillDto

### Community 105 - "auth.controller.ts"
Cohesion: 0.28
Nodes (8): AuthTokenResponseDto, GoogleLoginDto, LoginDto, QuickLoginDto, RegisterDto, SendEmailOtpDto, VerifyEmailOtpDto, QuickLoginRateLimitGuard

### Community 106 - "fix-spare-part-unit-prices.js"
Cohesion: 0.27
Nodes (8): BRAND_LABEL, brandLabel(), CATEGORY_PART_NAMES, mongoose, pick(), run(), UNIT_PRICE_RUPEES, unitPaise()

### Community 108 - "eslint.config.mjs"
Cohesion: 0.22
Nodes (8): @eslint/js@^9.18.0, eslint-plugin-prettier@^5.2.2, globals@^17.0.0, typescript-eslint@^8.20.0, @eslint/js, eslint-plugin-prettier, globals, typescript-eslint

### Community 109 - "@nestjs/schedule"
Cohesion: 0.14
Nodes (8): @nestjs/schedule@^6.1.3, @nestjs/schedule, PerformanceSummaryScheduler, SettlementScheduler, businessDate(), parseBusinessDate(), previousBusinessDate(), windowForBusinessDate()

### Community 112 - "cart.schema.ts"
Cohesion: 0.33
Nodes (6): ShopCart, ShopCartCoupon, ShopCartCouponSchema, ShopCartItem, ShopCartItemSchema, ShopCartSchema

### Community 113 - "booking-change-history.ts"
Cohesion: 0.13
Nodes (10): BOOKING_AUDIT_FIELDS, BookingAuditActorRole, BookingAuditField, buildChangeEvent(), normalizeAuditValue(), omitTechnicianForbiddenBookingFields(), TECHNICIAN_OMIT_BOOKING_FIELDS, categoriesForServiceSlug() (+2 more)

### Community 115 - "nest-cli.json"
Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, plugins, $schema, sourceRoot

### Community 116 - "search.module.ts"
Cohesion: 0.33
Nodes (4): @nestjs/elasticsearch@^11.1.0, @nestjs/elasticsearch, SearchModule, PARTS_INDEX

### Community 117 - "seed-services.js"
Cohesion: 0.29
Nodes (5): mongoose, Service, SERVICES_DATA, ServiceSchema, SubCategorySchema

### Community 118 - "seed-appliances.js"
Cohesion: 0.33
Nodes (4): Appliance, applianceSchema, godrejACs, mongoose

### Community 121 - "image-urls.ts"
Cohesion: 0.60
Nodes (5): filterAndRankImageUrls(), imageContentKey(), isProductImageUrl(), isRejectedImageUrl(), upscaleMarketplaceImageUrl()

### Community 122 - "seed-admin.js"
Cohesion: 0.40
Nodes (3): bcrypt, mongoose, UserSchema

### Community 137 - "TokenService"
Cohesion: 0.18
Nodes (4): TokenService, RefreshToken, RefreshTokenDocument, RefreshTokenSchema

### Community 143 - "seed-settlement-test-data.ts"
Cohesion: 0.36
Nodes (9): EarningDoc, main(), parseBusinessDate(), randEl(), randInt(), runCleanup(), runSeed(), TechDoc (+1 more)

### Community 144 - "jwt.strategy.ts"
Cohesion: 0.28
Nodes (4): passport-jwt@^4.0.1, passport-jwt, JwtStrategy, jwtSecret()

### Community 145 - "main.ts"
Cohesion: 0.33
Nodes (3): AppModule, setupSwagger(), bootstrap()

### Community 147 - "visits.service.spec.ts"
Cohesion: 0.52
Nodes (5): issueAndReturnInput(), issueForTechnician(), issueInput(), seedAssignedJob(), seedPart()

## Knowledge Gaps
- **34 isolated node(s):** `PREPARING`, `COMPLETED`, `FAILED`, `PREPARING`, `PREPARED` (+29 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1033 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **67 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mongoose` connect `@nestjs/mongoose` to `appliance.schema.ts`, `bookings.service.ts`, `BookingDocument`, `@nestjs/mongoose`, `package.json`, `TokenService`, `TechniciansService`, `home-data.integration.spec.ts`, `TechnicianEngineService`, `technician-schedule.ts`, `technician-auth.service.ts`, `leads.service.ts`, `mongoose`, `visits.service.spec.ts`, `performance-summary.service.ts`, `dependencies`, `settlement.ts`, `ShopProductType`, `PartOrdersService`, `technician-platform.module.ts`, `shop.module.ts`, `seed-appliances.ts`, `seed-5000-parts.js`, `cart.service.ts`, `shop.spec.ts`, `ServiceablePincodesService`, `dotenv`, `seed-spare-parts-v2.js`, `seed-spare-parts.js`, `bill-email.service.ts`, `seed.js`, `part-order.schema.ts`, `part-orders.service.ts`, `booking.schema.ts`, `fix-spare-part-unit-prices.js`, `cart.schema.ts`, `booking-change-history.ts`, `seed-services.js`, `seed-appliances.js`, `seed-admin.js`, `seed-allowed-pincodes.ts`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **What connects `PREPARING`, `COMPLETED`, `FAILED` to the rest of the system?**
  _34 weakly-connected nodes found - possible missing edges._
- **Should `AdminController` be split into smaller, more focused modules?**
  _Cohesion score 0.0680517916290274 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/common` connect `@nestjs/swagger` to `appliance.schema.ts`, `bookings.service.ts`, `BookingDocument`, `@nestjs/mongoose`, `@nestjs/mongoose`, `package.json`, `OpsQueueService`, `home-data.integration.spec.ts`, `TechnicianEngineService`, `technician-schedule.ts`, `technician-auth.service.ts`, `jwt.strategy.ts`, `mongoose`, `leads.service.ts`, `visits.service.spec.ts`, `assertValidCalendarDate`, `main.ts`, `admin.controller.ts`, `performance-summary.service.ts`, `dependencies`, `SettlementsService`, `ShopProductType`, `GstBreakdownDto`, `PartOrdersService`, `technician-platform.module.ts`, `shop.module.ts`, `gst.engine.ts`, `cart.service.ts`, `shop.spec.ts`, `ServiceablePincodesService`, `UsersService`, `bill-email.service.ts`, `app.controller.ts`, `part-orders.service.ts`, `auth.controller.ts`, `@nestjs/schedule`, `search.module.ts`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Should `appliance.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0741745816372682 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/mongoose` connect `@nestjs/mongoose` to `appliance.schema.ts`, `bookings.service.ts`, `BookingDocument`, `@nestjs/mongoose`, `package.json`, `TokenService`, `home-data.integration.spec.ts`, `technician-schedule.ts`, `technician-auth.service.ts`, `leads.service.ts`, `mongoose`, `visits.service.spec.ts`, `performance-summary.service.ts`, `dependencies`, `ShopProductType`, `PartOrdersService`, `technician-platform.module.ts`, `shop.module.ts`, `cart.service.ts`, `shop.spec.ts`, `ServiceablePincodesService`, `bill-email.service.ts`, `part-order.schema.ts`, `part-orders.service.ts`, `booking.schema.ts`, `cart.schema.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Should `bookings.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08627450980392157 - nodes in this community are weakly interconnected._