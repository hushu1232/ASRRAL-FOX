/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */


Shader "Live2D Cubism/Mask"
{
    Properties
    {
        // Culling setting.
        _Cull("Culling", Int) = 0
    }
    SubShader
    {
        Tags
        {
            "Queue" = "Transparent"
            "IgnoreProjector" = "True"
            "RenderType" = "Transparent"
            "RenderPipeline" = "UniversalPipeline"
        }


        LOD      100
        ZWrite   Off
        Lighting Off
        Cull     [_Cull]
        Blend    One One


        Pass
        {
            HLSLPROGRAM
            #pragma vertex   vert
            #pragma fragment frag

            #define CUBISM_MASK_ON

            #pragma multi_compile_local _ CUBISM_INVERT_ON


            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "CubismCG.cginc"


            struct Attributes
            {
                float4 vertex   : POSITION;
                float4 color    : COLOR;
                float2 texcoord : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };


            struct Varyings
            {
                float4 vertex   : SV_POSITION;
                float4 color    : COLOR;
                float2 texcoord : TEXCOORD0;
                UNITY_VERTEX_OUTPUT_STEREO
            };


            CBUFFER_START(UnityPerMaterial)
            sampler2D _MainTex;
            CUBISM_SHADER_VARIABLES
            CBUFFER_END


            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);


                CUBISM_TO_MASK_CLIP_POS(IN, OUT);


                OUT.color    = IN.color;
                OUT.texcoord = IN.texcoord;


                return OUT;
            }


            half4 frag(Varyings IN) : SV_Target
            {
                return CUBISM_MASK_CHANNEL * tex2D(_MainTex, IN.texcoord).a;

            }


            ENDHLSL
        }
    }
}
