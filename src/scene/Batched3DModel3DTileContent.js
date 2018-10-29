import {defined} from "../core/defined";
import {defaultValue} from "../core/defaultValue";
import {RuntimeError} from "../core/RuntimeError";
import {getStringFromTypedArray} from "../core/getStringFromTypedArray";
import Cesium3DTileFeatureTable from "./Cesium3DTileFeatureTable";
import B3DMLoader from "../renderer/loaders/B3DMLoader";
import {GLTFLoader} from "../renderer/loaders/GLTFLoader";
import GLFTModel from "./GLTFModel";


var sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;

let b3dmLoader = new B3DMLoader();

function getBatchIdAttributeName(gltf) {
    var batchIdAttributeName = ModelUtility.getAttributeOrUniformBySemantic(gltf, '_BATCHID');
    if (!defined(batchIdAttributeName)) {
        batchIdAttributeName = ModelUtility.getAttributeOrUniformBySemantic(gltf, 'BATCHID');
        if (defined(batchIdAttributeName)) {
            Batched3DModel3DTileContent._deprecationWarning('b3dm-legacy-batchid', 'The glTF in this b3dm uses the semantic `BATCHID`. Application-specific semantics should be prefixed with an underscore: `_BATCHID`.');
        }
    }
    return batchIdAttributeName;
}

function getVertexShaderCallback(content) {
    return function(vs, programId) {
        var batchTable = content._batchTable;
        var handleTranslucent = !defined(content._tileset.classificationType);

        var gltf = content._model.gltf;
        if (defined(gltf)) {
            content._batchIdAttributeName = getBatchIdAttributeName(gltf);
            content._diffuseAttributeOrUniformName[programId] = ModelUtility.getDiffuseAttributeOrUniform(gltf, programId);
        }

        var callback = batchTable.getVertexShaderCallback(handleTranslucent, content._batchIdAttributeName, content._diffuseAttributeOrUniformName[programId]);
        return defined(callback) ? callback(vs) : vs;
    };
}

function getFragmentShaderCallback(content) {
    return function(fs, programId) {
        var batchTable = content._batchTable;
        var handleTranslucent = !defined(content._tileset.classificationType);

        var gltf = content._model.gltf;
        if (defined(gltf)) {
            content._diffuseAttributeOrUniformName[programId] = ModelUtility.getDiffuseAttributeOrUniform(gltf, programId);
        }
        var callback = batchTable.getFragmentShaderCallback(handleTranslucent, content._diffuseAttributeOrUniformName[programId]);
        return defined(callback) ? callback(fs) : fs;
    };
}

function getPickIdCallback(content) {
    return function() {
        return content._batchTable.getPickId();
    };
}

function getClassificationFragmentShaderCallback(content) {
    return function(fs) {
        var batchTable = content._batchTable;
        var callback = batchTable.getClassificationFragmentShaderCallback();
        return defined(callback) ? callback(fs) : fs;
    };
}

function createColorChangedCallback(content) {
    return function(batchId, color) {
        content._model.updateCommands(batchId, color);
    };
}

function initialize(content, arrayBuffer, byteOffset) {
    var tileset = content._tileset;
    var tile = content._tile;
    var resource = content._resource;

    /*b3dmLoader.parse(arrayBuffer, tileset._gltfUpAxis).then(result=>{
        console.log(result)
    })*/
    //content._model = new GLTFModel

    content._model = GLFTModel.fromArrayBuffer(arrayBuffer)


/*    var byteStart = defaultValue(byteOffset, 0);
        byteOffset = byteStart;

        var uint8Array = new Uint8Array(arrayBuffer);
        var view = new DataView(arrayBuffer);
        byteOffset += sizeOfUint32;  // Skip magic

        var version = view.getUint32(byteOffset, true);
        if (version !== 1) {
            throw new RuntimeError('Only Batched 3D Model version 1 is supported.  Version ' + version + ' is not.');
        }
        byteOffset += sizeOfUint32;

        var byteLength = view.getUint32(byteOffset, true);
        byteOffset += sizeOfUint32;

        var featureTableJsonByteLength = view.getUint32(byteOffset, true);
        byteOffset += sizeOfUint32;

        var featureTableBinaryByteLength = view.getUint32(byteOffset, true);
        byteOffset += sizeOfUint32;

        var batchTableJsonByteLength = view.getUint32(byteOffset, true);
        byteOffset += sizeOfUint32;

        var batchTableBinaryByteLength = view.getUint32(byteOffset, true);
        byteOffset += sizeOfUint32;

        var batchLength;

        // Legacy header #1: [batchLength] [batchTableByteLength]
        // Legacy header #2: [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]
        // Current header: [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength]
        // If the header is in the first legacy format 'batchTableJsonByteLength' will be the start of the JSON string (a quotation mark) or the glTF magic.
        // Accordingly its first byte will be either 0x22 or 0x67, and so the minimum uint32 expected is 0x22000000 = 570425344 = 570MB. It is unlikely that the feature table JSON will exceed this length.
        // The check for the second legacy format is similar, except it checks 'batchTableBinaryByteLength' instead
        if (batchTableJsonByteLength >= 570425344) {
            // First legacy check
            byteOffset -= sizeOfUint32 * 2;
            batchLength = featureTableJsonByteLength;
            batchTableJsonByteLength = featureTableBinaryByteLength;
            batchTableBinaryByteLength = 0;
            featureTableJsonByteLength = 0;
            featureTableBinaryByteLength = 0;
            Batched3DModel3DTileContent._deprecationWarning('b3dm-legacy-header', 'This b3dm header is using the legacy format [batchLength] [batchTableByteLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength] from https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/Batched3DModel.');
        } else if (batchTableBinaryByteLength >= 570425344) {
            // Second legacy check
            byteOffset -= sizeOfUint32;
            batchLength = batchTableJsonByteLength;
            batchTableJsonByteLength = featureTableJsonByteLength;
            batchTableBinaryByteLength = featureTableBinaryByteLength;
            featureTableJsonByteLength = 0;
            featureTableBinaryByteLength = 0;
            Batched3DModel3DTileContent._deprecationWarning('b3dm-legacy-header', 'This b3dm header is using the legacy format [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength] from https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/Batched3DModel.');
        }

        var featureTableJson;
        if (featureTableJsonByteLength === 0) {
            featureTableJson = {
                BATCH_LENGTH : defaultValue(batchLength, 0)
            };
        } else {
            var featureTableString = getStringFromTypedArray(uint8Array, byteOffset, featureTableJsonByteLength);
            featureTableJson = JSON.parse(featureTableString);
            byteOffset += featureTableJsonByteLength;
        }

        var featureTableBinary = new Uint8Array(arrayBuffer, byteOffset, featureTableBinaryByteLength);
        byteOffset += featureTableBinaryByteLength;

        var featureTable = new Cesium3DTileFeatureTable(featureTableJson, featureTableBinary);

        batchLength = featureTable.getGlobalProperty('BATCH_LENGTH');
        featureTable.featuresLength = batchLength;

        var batchTableJson;
        var batchTableBinary;
        if (batchTableJsonByteLength > 0) {
            // PERFORMANCE_IDEA: is it possible to allocate this on-demand?  Perhaps keep the
            // arraybuffer/string compressed in memory and then decompress it when it is first accessed.
            //
            // We could also make another request for it, but that would make the property set/get
            // API async, and would double the number of numbers in some cases.
            var batchTableString = getStringFromTypedArray(uint8Array, byteOffset, batchTableJsonByteLength);
            batchTableJson = JSON.parse(batchTableString);
            byteOffset += batchTableJsonByteLength;

            if (batchTableBinaryByteLength > 0) {
                // Has a batch table binary
                batchTableBinary = new Uint8Array(arrayBuffer, byteOffset, batchTableBinaryByteLength);
                // Copy the batchTableBinary section and let the underlying ArrayBuffer be freed
                batchTableBinary = new Uint8Array(batchTableBinary);
                byteOffset += batchTableBinaryByteLength;
            }
        }

        var colorChangedCallback;
        if (defined(tileset.classificationType)) {
            colorChangedCallback = createColorChangedCallback(content);
        }

        var batchTable = new Cesium3DTileBatchTable(content, batchLength, batchTableJson, batchTableBinary, colorChangedCallback);
        content._batchTable = batchTable;

        var gltfByteLength = byteStart + byteLength - byteOffset;
        if (gltfByteLength === 0) {
            throw new RuntimeError('glTF byte length must be greater than 0.');
        }

        var gltfView;
        if (byteOffset % 4 === 0) {
            gltfView = new Uint8Array(arrayBuffer, byteOffset, gltfByteLength);
        } else {
            // Create a copy of the glb so that it is 4-byte aligned
            Batched3DModel3DTileContent._deprecationWarning('b3dm-glb-unaligned', 'The embedded glb is not aligned to a 4-byte boundary.');
            gltfView = new Uint8Array(uint8Array.subarray(byteOffset, byteOffset + gltfByteLength));
        }

        var pickObject = {
            content : content,
            primitive : tileset
        };

        content._rtcCenterTransform = Matrix4.clone(Matrix4.IDENTITY);
        var rtcCenter = featureTable.getGlobalProperty('RTC_CENTER', ComponentDatatype.FLOAT, 3);
        if (defined(rtcCenter)) {
            content._rtcCenterTransform = Matrix4.fromTranslation(Cartesian3.fromArray(rtcCenter), content._rtcCenterTransform);
        }

        content._contentModelMatrix = Matrix4.multiply(tile.computedTransform, content._rtcCenterTransform, new Matrix4());

        if (!defined(tileset.classificationType)) {
            // PERFORMANCE_IDEA: patch the shader on demand, e.g., the first time show/color changes.
            // The pick shader still needs to be patched.
            content._model = new Model({
                gltf : gltfView,
                cull : false,           // The model is already culled by 3D Tiles
                releaseGltfJson : true, // Models are unique and will not benefit from caching so save memory
                opaquePass : Pass.CESIUM_3D_TILE, // Draw opaque portions of the model during the 3D Tiles pass
                basePath : resource,
                requestType : RequestType.TILES3D,
                modelMatrix: content._contentModelMatrix,
                upAxis : tileset._gltfUpAxis,
                forwardAxis : Axis.X,
                shadows: tileset.shadows,
                debugWireframe: tileset.debugWireframe,
                incrementallyLoadTextures : false,
                vertexShaderLoaded : getVertexShaderCallback(content),
                fragmentShaderLoaded : getFragmentShaderCallback(content),
                uniformMapLoaded : batchTable.getUniformMapCallback(),
                pickIdLoaded : getPickIdCallback(content),
                addBatchIdToGeneratedShaders : (batchLength > 0), // If the batch table has values in it, generated shaders will need a batchId attribute
                pickObject : pickObject
            });
        } else {
            // This transcodes glTF to an internal representation for geometry so we can take advantage of the re-batching of vector data.
            // For a list of limitations on the input glTF, see the documentation for classificationType of Cesium3DTileset.
            content._model = new ClassificationModel({
                gltf : gltfView,
                cull : false,           // The model is already culled by 3D Tiles
                basePath : resource,
                requestType : RequestType.TILES3D,
                modelMatrix: content._contentModelMatrix,
                upAxis : tileset._gltfUpAxis,
                forwardAxis : Axis.X,
                debugWireframe : tileset.debugWireframe,
                vertexShaderLoaded : getVertexShaderCallback(content),
                classificationShaderLoaded : getClassificationFragmentShaderCallback(content),
                uniformMapLoaded : batchTable.getUniformMapCallback(),
                pickIdLoaded : getPickIdCallback(content),
                classificationType : tileset._classificationType,
                batchTable : batchTable
            });
    }*/
}

function createFeatures(content) {
    var featuresLength = content.featuresLength;
    if (!defined(content._features) && (featuresLength > 0)) {
        var features = new Array(featuresLength);
        for (var i = 0; i < featuresLength; ++i) {
            features[i] = new Cesium3DTileFeature(content, i);
        }
        content._features = features;
    }
}


export default class Batched3DModel3DTileContent {
    constructor(tileset, tile, resource, arrayBuffer, byteOffset){
        this._tileset = tileset;
        this._tile = tile;
        this._resource = resource;
        this._model = undefined;
        this._batchTable = undefined;
        this._features = undefined;

        // Populate from gltf when available
        this._batchIdAttributeName = undefined;
        this._diffuseAttributeOrUniformName = {};

        this._rtcCenterTransform = undefined;
        this._contentModelMatrix = undefined;

        this.featurePropertiesDirty = false;

        initialize(this, arrayBuffer, byteOffset);
    }
    
    updateFixedFrame(){
    
    }

    get readyPromise(){
        return this._model.readyPromise
    }
}
